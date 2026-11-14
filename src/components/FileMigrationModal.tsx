import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  X,
  Check,
  AlertTriangle,
  FileText,
  Table2,
  Loader2,
} from 'lucide-react';
import { auth, getCachedWorkspaceToken, signInWithGoogleWorkspace } from '../lib/firebase';
import {
  listGoogleSpreadsheets,
  getSpreadsheetMetadata,
  readGoogleSheetRows,
  type GoogleSpreadsheetItem,
} from '../services/googleSheetsService';
import type { ContactStatus, Lead, LeadPriority, LeadSource } from '../types/crm';
import { CONTACT_STATUSES } from '../types/crm';
import { formatDurationSeconds, normalizePhoneNumber, parseDurationToSeconds } from '../utils/phone';

interface FileMigrationModalProps {
  open: boolean;
  existingLeads: Lead[];
  defaultCountryCode: string;
  onClose: () => void;
  onCommitImport: (
    rows: Array<{
      applicantName: string;
      phoneNumber: string;
      location: string;
      campaignName: string;
      contactStatus: ContactStatus;
      priority: LeadPriority;
      callDurationSeconds: number;
      followUpDate: string;
      notes: string;
      leadSource: LeadSource;
      importedFrom: string;
    }>,
    skipDuplicates: boolean
  ) => Promise<{ created: number; duplicates: number }>;
}

type ColumnKey =
  | 'ignore'
  | 'applicantName'
  | 'phoneNumber'
  | 'location'
  | 'campaignName'
  | 'contactStatus'
  | 'callDuration'
  | 'followUpDate'
  | 'notes';

const COLUMN_OPTIONS: Array<{ value: ColumnKey; label: string }> = [
  { value: 'ignore', label: 'Ignore Column' },
  { value: 'applicantName', label: 'Applicant Name' },
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'location', label: 'Location / City' },
  { value: 'campaignName', label: 'Campaign Name' },
  { value: 'contactStatus', label: 'Contact Status' },
  { value: 'callDuration', label: 'Call Duration' },
  { value: 'followUpDate', label: 'Follow-up Date' },
  { value: 'notes', label: 'Notes' },
];

function guessColumnMapping(header: string): ColumnKey {
  const h = header.toLowerCase().trim();
  if (/name|applicant|student|participant|full.?name/.test(h)) return 'applicantName';
  if (/phone|mobile|contact.?no|whatsapp|tel|number/.test(h) && !/serial/.test(h)) return 'phoneNumber';
  if (/location|city|town|district|address|place/.test(h)) return 'location';
  if (/campaign|ad.?set|source.?name/.test(h)) return 'campaignName';
  if (/status|stage|outcome/.test(h)) return 'contactStatus';
  if (/duration|talk.?time|call.?time|length/.test(h)) return 'callDuration';
  if (/follow.?up|callback|reminder/.test(h)) return 'followUpDate';
  if (/note|remark|comment|detail/.test(h)) return 'notes';
  return 'ignore';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const FileMigrationModal: React.FC<FileMigrationModalProps> = ({
  open,
  existingLeads,
  defaultCountryCode,
  onClose,
  onCommitImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceTab, setSourceTab] = useState<'file' | 'sheets'>('file');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceKind, setSourceKind] = useState<LeadSource>('File Import');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnKey[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Google Sheets state
  const [sheetsList, setSheetsList] = useState<GoogleSpreadsheetItem[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTabName, setSelectedTabName] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);

  if (!open) return null;

  const resetPreview = () => {
    setHeaders([]);
    setRawRows([]);
    setMapping([]);
    setSourceLabel('');
    setError('');
  };

  const loadTabularData = (hdrs: string[], rows: string[][], label: string, kind: LeadSource) => {
    const cleanHeaders = hdrs.map((h, idx) => String(h || `Column ${idx + 1}`).trim());
    setHeaders(cleanHeaders);
    setRawRows(rows.filter((r) => r.some((cell) => String(cell ?? '').trim() !== '')));
    setMapping(cleanHeaders.map(guessColumnMapping));
    setSourceLabel(label);
    setSourceKind(kind);
  };

  const handleFileSelected = async (file: File) => {
    setError('');
    setLoading(true);
    resetPreview();

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new Error('The uploaded spreadsheet contains no sheets.');
        const sheet = wb.Sheets[firstSheet];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (matrix.length < 2) {
          throw new Error('The file must contain a header row and at least one lead row.');
        }
        const hdrs = (matrix[0] || []).map((c) => String(c ?? ''));
        const rows = matrix.slice(1).map((r) => hdrs.map((_, i) => String((r as unknown[])[i] ?? '')));
        loadTabularData(hdrs, rows, file.name, 'File Import');
      } else if (ext === 'pdf' || ext === 'docx') {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Please sign in again to parse documents.');
        const buf = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(buf);
        const res = await fetch('/api/import/parse-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            base64Data,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Unable to parse document.');
        }

        if (data.extractedLeads && Array.isArray(data.extractedLeads)) {
          const hdrs = ['Applicant Name', 'Phone Number', 'Location', 'Call Duration', 'Notes'];
          const rows = data.extractedLeads.map((item: any) => [
            item.applicantName || '',
            item.phoneNumber || '',
            item.location || '',
            formatDurationSeconds(item.callDurationSeconds || 0),
            item.notes || '',
          ]);
          if (rows.length === 0) {
            throw new Error('No phone numbers or lead rows were detected inside this document.');
          }
          loadTabularData(hdrs, rows, file.name, 'File Import');
        } else if (data.headers && data.rows) {
          loadTabularData(data.headers, data.rows, file.name, 'File Import');
        } else {
          throw new Error('No tabular lead rows found in document.');
        }
      } else {
        throw new Error('Unsupported format. Upload .csv, .xlsx, .xls, .pdf, or .docx files.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to read file.');
    } finally {
      setLoading(false);
    }
  };

  const ensureGoogleToken = async (): Promise<string> => {
    let token = getCachedWorkspaceToken();
    if (!token) {
      const authRes = await signInWithGoogleWorkspace(true);
      token = authRes.accessToken;
    }
    if (!token) {
      throw new Error('Google Sheets permission token unavailable. Please authorize Google Sheets.');
    }
    return token;
  };

  const handleLoadSpreadsheets = async () => {
    setError('');
    setSheetsLoading(true);
    try {
      const token = await ensureGoogleToken();
      const files = await listGoogleSpreadsheets(token);
      setSheetsList(files);
      if (files.length === 0) {
        setError('No Google Spreadsheets found in your Google Drive.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Google Spreadsheets.');
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSelectSpreadsheet = async (sheetId: string) => {
    setSelectedSheetId(sheetId);
    setSheetTabs([]);
    setSelectedTabName('');
    if (!sheetId) return;
    setSheetsLoading(true);
    try {
      const token = await ensureGoogleToken();
      const meta = await getSpreadsheetMetadata(token, sheetId);
      setSheetTabs(meta.sheets);
      if (meta.sheets[0]) {
        setSelectedTabName(meta.sheets[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to read spreadsheet tabs.');
    } finally {
      setSheetsLoading(false);
    }
  };

  const handlePreviewGoogleSheet = async () => {
    if (!selectedSheetId || !selectedTabName) return;
    setError('');
    setSheetsLoading(true);
    try {
      const token = await ensureGoogleToken();
      const values = await readGoogleSheetRows(token, selectedSheetId, selectedTabName);
      if (values.length < 2) {
        throw new Error('The selected Google Sheet tab has fewer than 2 rows.');
      }
      const sheetObj = sheetsList.find((s) => s.id === selectedSheetId);
      const hdrs = values[0];
      const rows = values.slice(1).map((r) => hdrs.map((_, i) => String(r[i] ?? '')));
      loadTabularData(
        hdrs,
        rows,
        `Google Sheet: ${sheetObj?.name || selectedSheetId} (${selectedTabName})`,
        'Google Sheets Import'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch rows from Google Sheets.');
    } finally {
      setSheetsLoading(false);
    }
  };

  // Build normalized candidate leads from mapped columns
  const existingPhoneSet = new Set(existingLeads.map((l) => l.normalizedPhone));

  const mappedCandidates = rawRows
    .map((row) => {
      const record: Record<ColumnKey, string> = {
        ignore: '',
        applicantName: '',
        phoneNumber: '',
        location: '',
        campaignName: '',
        contactStatus: '',
        callDuration: '',
        followUpDate: '',
        notes: '',
      };

      mapping.forEach((colKey, idx) => {
        if (colKey !== 'ignore' && row[idx] !== undefined) {
          const val = String(row[idx]).trim();
          if (val) {
            record[colKey] = record[colKey] ? `${record[colKey]} ${val}` : val;
          }
        }
      });

      const phoneClean = record.phoneNumber;
      const { e164 } = normalizePhoneNumber(phoneClean, defaultCountryCode);
      const isValidPhone = e164.replace(/\D/g, '').length >= 8;
      const isDuplicate = isValidPhone && existingPhoneSet.has(e164);

      const matchedStatus = CONTACT_STATUSES.find(
        (s) => s.toLowerCase() === record.contactStatus.toLowerCase()
      );

      return {
        applicantName: record.applicantName || 'Unknown Applicant',
        phoneNumber: e164 || phoneClean,
        location: record.location || '',
        campaignName: record.campaignName || '',
        contactStatus: (matchedStatus || 'New Lead') as ContactStatus,
        priority: 'Warm' as LeadPriority,
        callDurationSeconds: parseDurationToSeconds(record.callDuration),
        followUpDate: record.followUpDate || '',
        notes: record.notes || '',
        leadSource: sourceKind,
        importedFrom: sourceLabel,
        isValidPhone,
        isDuplicate,
      };
    })
    .filter((c) => c.isValidPhone);

  const duplicateCount = mappedCandidates.filter((c) => c.isDuplicate).length;
  const readyCount = skipDuplicates
    ? mappedCandidates.filter((c) => !c.isDuplicate).length
    : mappedCandidates.length;

  const handleImport = async () => {
    if (readyCount === 0) return;
    setImporting(true);
    setError('');
    try {
      await onCommitImport(mappedCandidates, skipDuplicates);
      resetPreview();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-4xl w-full shadow-lg overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#1E1C1A] text-[#D4AF6A] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Insert Existing Files — Data Migration
              </h3>
              <p className="text-xs text-[#6B645B]">
                Supports CSV (.csv), Excel (.xlsx, .xls), Google Sheets, PDF (.pdf), and Word (.docx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1E1C1A] hover:bg-[#F1EDE4]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Source Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-[#E7E2D8] pb-3">
            <button
              type="button"
              onClick={() => setSourceTab('file')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                sourceTab === 'file'
                  ? 'bg-[#1E1C1A] text-white'
                  : 'bg-[#F8F7F4] text-[#57514A] hover:text-[#1E1C1A]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File (CSV / Excel / PDF / Word)</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('sheets')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                sourceTab === 'sheets'
                  ? 'bg-[#1E1C1A] text-white'
                  : 'bg-[#F8F7F4] text-[#57514A] hover:text-[#1E1C1A]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Import from Google Sheets</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {sourceTab === 'file' && headers.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelected(file);
              }}
              className="border-2 border-dashed border-[#D6D0C4] hover:border-[#B08942] rounded-xl p-10 text-center bg-[#FBF9F5] transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                }}
              />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#B08942]" />
                  <p className="text-sm font-medium text-[#1E1C1A]">
                    Extracting lead records from file...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F1EDE4] border border-[#E7E2D8] flex items-center justify-center text-[#9A7230]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1E1C1A]">
                      Drop your existing lead file here, or browse
                    </p>
                    <p className="text-xs text-[#6B645B] mt-1">
                      Supported formats: <span className="font-mono">.csv</span>,{' '}
                      <span className="font-mono">.xlsx</span>,{' '}
                      <span className="font-mono">.xls</span>,{' '}
                      <span className="font-mono">.pdf</span>,{' '}
                      <span className="font-mono">.docx</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold transition-colors"
                  >
                    Select Existing File
                  </button>
                </div>
              )}
            </div>
          )}

          {sourceTab === 'sheets' && headers.length === 0 && (
            <div className="p-5 rounded-xl border border-[#E7E2D8] bg-[#FBF9F5] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1E1C1A]">
                    Select a Google Spreadsheet to Migrate
                  </p>
                  <p className="text-xs text-[#6B645B]">
                    Connect your Google account to browse Spreadsheets in Google Drive.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSpreadsheets}
                  disabled={sheetsLoading}
                  className="px-4 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {sheetsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{sheetsList.length > 0 ? 'Refresh Spreadsheets' : 'Connect & Load Google Sheets'}</span>
                </button>
              </div>

              {sheetsList.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                      Spreadsheet
                    </label>
                    <select
                      value={selectedSheetId}
                      onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg"
                    >
                      <option value="">Choose a spreadsheet...</option>
                      {sheetsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                      Sheet Tab
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedTabName}
                        onChange={(e) => setSelectedTabName(e.target.value)}
                        disabled={sheetTabs.length === 0}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg disabled:opacity-50"
                      >
                        {sheetTabs.length === 0 ? (
                          <option value="">Select spreadsheet first</option>
                        ) : (
                          sheetTabs.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={handlePreviewGoogleSheet}
                        disabled={!selectedSheetId || !selectedTabName || sheetsLoading}
                        className="px-3.5 py-2 rounded-lg bg-[#B08942] hover:bg-[#9A7230] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                      >
                        Load Rows
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column Mapping & Preview */}
          {headers.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E7E2D8]">
                <div className="text-xs">
                  <span className="font-semibold text-[#1E1C1A]">Source: {sourceLabel}</span>
                  <span className="mx-2 text-[#A8A095]">·</span>
                  <span className="text-[#57514A] tabular-nums">
                    {mappedCandidates.length} valid phone rows detected
                  </span>
                  {duplicateCount > 0 && (
                    <>
                      <span className="mx-2 text-[#A8A095]">·</span>
                      <span className="text-amber-700 font-medium tabular-nums">
                        {duplicateCount} existing phone duplicate(s)
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={resetPreview}
                  className="text-xs font-semibold text-[#9A7230] hover:underline"
                >
                  Choose Different Source
                </button>
              </div>

              {/* Column Mapper */}
              <div>
                <p className="text-xs font-semibold text-[#4A443D] mb-2">
                  Verify Column Mapping
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {headers.map((hdr, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-[#E7E2D8] bg-[#FBF9F5]">
                      <p className="text-[11px] font-medium text-[#6B645B] truncate mb-1" title={hdr}>
                        {hdr}
                      </p>
                      <select
                        value={mapping[idx] || 'ignore'}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[idx] = e.target.value as ColumnKey;
                          setMapping(next);
                        }}
                        className="w-full px-2 py-1 text-xs bg-white border border-[#D6D0C4] rounded"
                      >
                        {COLUMN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-[#E7E2D8] rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F7F4] border-b border-[#E7E2D8] text-[#57514A]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Applicant Name</th>
                        <th className="px-3 py-2 font-semibold">Phone</th>
                        <th className="px-3 py-2 font-semibold">Location</th>
                        <th className="px-3 py-2 font-semibold">Call Duration</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Match Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E2D8]">
                      {mappedCandidates.slice(0, 25).map((c, idx) => (
                        <tr key={idx} className={c.isDuplicate ? 'bg-amber-50/50' : 'bg-white'}>
                          <td className="px-3 py-2 font-medium text-[#1E1C1A]">{c.applicantName}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{c.phoneNumber}</td>
                          <td className="px-3 py-2 text-[#57514A]">{c.location || '—'}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {formatDurationSeconds(c.callDurationSeconds)}
                          </td>
                          <td className="px-3 py-2">{c.contactStatus}</td>
                          <td className="px-3 py-2">
                            {c.isDuplicate ? (
                              <span className="text-amber-700 font-medium">Duplicate phone</span>
                            ) : (
                              <span className="text-emerald-700 font-medium">New lead</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {mappedCandidates.length > 25 && (
                  <div className="px-3 py-2 bg-[#FBF9F5] border-t border-[#E7E2D8] text-[11px] text-[#6B645B]">
                    Showing first 25 of {mappedCandidates.length} detected records.
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-[#1E1C1A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-[#D6D0C4]"
                />
                <span>
                  Skip duplicate phone numbers automatically (recommended to avoid overwriting existing leads)
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between gap-3">
          <p className="text-xs text-[#6B645B]">
            All imported rows record <span className="font-mono">{sourceLabel || 'source file'}</span> in the Existing Files column.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#57514A] bg-white border border-[#D6D0C4] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || readyCount === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E1C1A] hover:bg-[#322D28] rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 text-[#D4AF6A]" />
              <span>
                {importing ? 'Importing...' : `Import ${readyCount} Lead${readyCount === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
