import type { Lead } from '../types/crm';
import { formatDurationSeconds } from '../utils/phone';

export interface GoogleSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: string[];
}

const SHEETS_HEADERS = [
  'Lead ID',
  'Serial Number',
  'Applicant Name',
  'Phone Number',
  'Location',
  'Lead Date',
  'Lead Time',
  'Lead Source',
  'Campaign Name',
  'GCLID',
  'Call Duration',
  'Existing File Source',
  'Contact Status',
  'Follow-up Date',
  'Follow-up Notes',
  'Registration Status',
];

export async function listGoogleSpreadsheets(accessToken: string): Promise<GoogleSpreadsheetItem[]> {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Unable to list Google Spreadsheets (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Unable to read spreadsheet metadata (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const sheets: string[] = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Untitled Spreadsheet',
    sheets,
  };
}

export async function createCRMGoogleSpreadsheet(
  accessToken: string,
  title = 'SHRI V.M. JOSHI INSTITUTE – Yantra Workshop Leads'
): Promise<SpreadsheetMetadata> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Leads' } }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Spreadsheet (${res.status}): ${errText}`);
  }
  const created = await res.json();
  const spreadsheetId = created.spreadsheetId as string;

  // Initialize header row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent('Leads!A1:P1')}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [SHEETS_HEADERS] }),
    }
  );

  return {
    spreadsheetId,
    title,
    sheets: ['Leads'],
  };
}

export async function readGoogleSheetRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTabName: string
): Promise<string[][]> {
  const range = `'${sheetTabName.replace(/'/g, "''")}'!A1:Z2000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to read Google Sheet rows (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.values || [];
}

function leadToSheetRow(lead: Lead): string[] {
  const dt = new Date(lead.createdAt);
  const validDate = !Number.isNaN(dt.getTime());
  const leadDate = validDate ? dt.toISOString().slice(0, 10) : '';
  const leadTime = validDate
    ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  return [
    lead.id,
    String(lead.serialNumber || ''),
    lead.applicantName,
    lead.phoneNumber,
    lead.location || '',
    leadDate,
    leadTime,
    lead.leadSource,
    lead.campaignName || '',
    lead.gclid || '',
    formatDurationSeconds(lead.callDurationSeconds),
    lead.importedFrom || '',
    lead.contactStatus,
    lead.followUpDate ? `${lead.followUpDate}${lead.followUpTime ? ` ${lead.followUpTime}` : ''}` : '',
    lead.followUpNotes || lead.notes || '',
    lead.registrationStatus,
  ];
}

export async function syncLeadsToGoogleSheet(params: {
  accessToken: string;
  spreadsheetId: string;
  sheetTabName: string;
  leads: Lead[];
}): Promise<{ appended: number; updated: number; skippedDuplicates: number }> {
  const { accessToken, spreadsheetId, sheetTabName, leads } = params;
  const escapedTab = `'${sheetTabName.replace(/'/g, "''")}'`;

  const existingValues = await readGoogleSheetRows(accessToken, spreadsheetId, sheetTabName);
  let headerRow = existingValues[0] || [];

  // Ensure header exists if sheet is empty
  if (existingValues.length === 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${escapedTab}!A1:P1`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [SHEETS_HEADERS] }),
      }
    );
    headerRow = SHEETS_HEADERS;
  }

  const idIdx = headerRow.findIndex((h) => h.toLowerCase().includes('lead id'));
  const phoneIdx = headerRow.findIndex((h) => h.toLowerCase().includes('phone'));

  // Map existing Lead ID or normalized phone digits -> 1-based row number
  const rowByLeadId = new Map<string, number>();
  const rowByPhoneDigits = new Map<string, number>();

  for (let i = 1; i < existingValues.length; i++) {
    const row = existingValues[i];
    const rowNum = i + 1;
    const rowLeadId = idIdx >= 0 ? (row[idIdx] || '').trim() : (row[0] || '').trim();
    const rowPhone = phoneIdx >= 0 ? (row[phoneIdx] || '').replace(/\D/g, '') : (row[3] || '').replace(/\D/g, '');
    if (rowLeadId) rowByLeadId.set(rowLeadId, rowNum);
    if (rowPhone) rowByPhoneDigits.set(rowPhone.slice(-10), rowNum);
  }

  const batchUpdates: Array<{ range: string; values: string[][] }> = [];
  const rowsToAppend: string[][] = [];
  let updated = 0;
  let appended = 0;
  let skippedDuplicates = 0;

  const seenInBatch = new Set<string>();

  for (const lead of leads) {
    const phoneKey = (lead.normalizedPhone || lead.phoneNumber).replace(/\D/g, '').slice(-10);
    if (phoneKey && seenInBatch.has(phoneKey)) {
      skippedDuplicates++;
      continue;
    }
    if (phoneKey) seenInBatch.add(phoneKey);

    const existingRowNum =
      rowByLeadId.get(lead.id) || (phoneKey ? rowByPhoneDigits.get(phoneKey) : undefined);

    const rowValues = leadToSheetRow(lead);

    if (existingRowNum) {
      batchUpdates.push({
        range: `${escapedTab}!A${existingRowNum}:P${existingRowNum}`,
        values: [rowValues],
      });
      updated++;
    } else {
      rowsToAppend.push(rowValues);
      appended++;
    }
  }

  if (batchUpdates.length > 0) {
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchUpdates,
        }),
      }
    );
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Failed updating existing rows in Google Sheets: ${errText}`);
    }
  }

  if (rowsToAppend.length > 0) {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${escapedTab}!A:P`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rowsToAppend }),
      }
    );
    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`Failed appending new rows to Google Sheets: ${errText}`);
    }
  }

  return { appended, updated, skippedDuplicates };
}
