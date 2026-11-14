import * as XLSX from 'xlsx';
import type { Lead } from '../types/crm';
import { formatDurationSeconds } from '../utils/phone';

export interface ExportRow {
  'Serial Number': number;
  'Applicant Name': string;
  'Phone Number': string;
  'Location': string;
  'Lead Date': string;
  'Lead Time': string;
  'Lead Source': string;
  'Campaign Name': string;
  'GCLID': string;
  'Call Duration': string;
  'Existing File Source': string;
  'Contact Status': string;
  'Follow-up Date': string;
  'Follow-up Notes': string;
  'Registration Status': string;
}

export function leadsToExportRows(leads: Lead[]): ExportRow[] {
  return leads.map((lead, idx) => {
    const dt = new Date(lead.createdAt);
    const validDate = !Number.isNaN(dt.getTime());
    const leadDate = validDate ? dt.toISOString().slice(0, 10) : '';
    const leadTime = validDate
      ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '';

    return {
      'Serial Number': lead.serialNumber || idx + 1,
      'Applicant Name': lead.applicantName,
      'Phone Number': lead.phoneNumber,
      'Location': lead.location || '',
      'Lead Date': leadDate,
      'Lead Time': leadTime,
      'Lead Source': lead.leadSource,
      'Campaign Name': lead.campaignName || '',
      'GCLID': lead.gclid || '',
      'Call Duration': formatDurationSeconds(lead.callDurationSeconds),
      'Existing File Source': lead.importedFrom || '',
      'Contact Status': lead.contactStatus,
      'Follow-up Date': lead.followUpDate
        ? `${lead.followUpDate}${lead.followUpTime ? ` ${lead.followUpTime}` : ''}`
        : '',
      'Follow-up Notes': lead.followUpNotes || lead.notes || '',
      'Registration Status': lead.registrationStatus,
    };
  });
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadLeadsAsCsv(leads: Lead[], filenamePrefix = 'yantra-workshop-leads') {
  const rows = leadsToExportRows(leads);
  const headers: (keyof ExportRow)[] = [
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

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadLeadsAsExcel(leads: Lead[], filenamePrefix = 'yantra-workshop-leads') {
  const rows = leadsToExportRows(leads);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 }, // Serial Number
    { wch: 24 }, // Applicant Name
    { wch: 18 }, // Phone Number
    { wch: 18 }, // Location
    { wch: 12 }, // Lead Date
    { wch: 12 }, // Lead Time
    { wch: 24 }, // Lead Source
    { wch: 26 }, // Campaign Name
    { wch: 22 }, // GCLID
    { wch: 14 }, // Call Duration
    { wch: 24 }, // Existing File Source
    { wch: 22 }, // Contact Status
    { wch: 18 }, // Follow-up Date
    { wch: 36 }, // Follow-up Notes
    { wch: 18 }, // Registration Status
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Workshop Leads');
  XLSX.writeFile(workbook, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
