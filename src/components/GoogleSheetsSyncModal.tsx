import React, { useState, useEffect } from 'react';
import { Table2, X, Plus, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getCachedWorkspaceToken, signInWithGoogleWorkspace } from '../lib/firebase';
import {
  listGoogleSpreadsheets,
  getSpreadsheetMetadata,
  createCRMGoogleSpreadsheet,
  syncLeadsToGoogleSheet,
  type GoogleSpreadsheetItem,
} from '../services/googleSheetsService';
import type { Lead, WorkshopSettings } from '../types/crm';

interface GoogleSheetsSyncModalProps {
  open: boolean;
  leadsToSync: Lead[];
  settings: WorkshopSettings | null;
  onClose: () => void;
  onSaveSheetConfig: (config: {
    googleSheetId: string;
    googleSheetTitle: string;
    googleSheetTabName: string;
  }) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  open,
  leadsToSync,
  settings,
  onClose,
  onSaveSheetConfig,
  onNotify,
}) => {
  const [hasToken, setHasToken] = useState(Boolean(getCachedWorkspaceToken()));
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [selectedId, setSelectedId] = useState(settings?.googleSheetId || '');
  const [selectedTitle, setSelectedTitle] = useState(settings?.googleSheetTitle || '');
  const [tabs, setTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState(settings?.googleSheetTabName || 'Leads');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setHasToken(Boolean(getCachedWorkspaceToken()));
      setSelectedId(settings?.googleSheetId || '');
      setSelectedTitle(settings?.googleSheetTitle || '');
      setSelectedTab(settings?.googleSheetTabName || 'Leads');
      setConfirmOpen(false);
      setError('');
    }
  }, [open, settings]);

  if (!open) return null;

  const handleConnectGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGoogleWorkspace(true);
      if (res.accessToken) {
        setHasToken(true);
        const files = await listGoogleSpreadsheets(res.accessToken);
        setSpreadsheets(files);
        if (settings?.googleSheetId) {
          const meta = await getSpreadsheetMetadata(res.accessToken, settings.googleSheetId);
          setTabs(meta.sheets);
        }
      } else {
        throw new Error('Could not obtain Google Sheets access token.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshList = async () => {
    const token = getCachedWorkspaceToken();
    if (!token) {
      await handleConnectGoogle();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const files = await listGoogleSpreadsheets(token);
      setSpreadsheets(files);
    } catch (err: any) {
      setError(err?.message || 'Failed to load spreadsheets.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSheet = async (id: string) => {
    setSelectedId(id);
    const match = spreadsheets.find((s) => s.id === id);
    setSelectedTitle(match?.name || '');
    if (!id) {
      setTabs([]);
      return;
    }
    const token = getCachedWorkspaceToken();
    if (!token) return;
    setLoading(true);
    try {
      const meta = await getSpreadsheetMetadata(token, id);
      setTabs(meta.sheets);
      setSelectedTitle(meta.title);
      if (meta.sheets[0]) setSelectedTab(meta.sheets[0]);
    } catch (err: any) {
      setError(err?.message || 'Unable to inspect spreadsheet tabs.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewSheet = async () => {
    const token = getCachedWorkspaceToken();
    if (!token) {
      setError('Connect Google Sheets first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await createCRMGoogleSpreadsheet(
        token,
        `${settings?.instituteName || 'SHRI V.M. JOSHI INSTITUTE'} – Yantra Workshop Leads`
      );
      setSpreadsheets((prev) => [{ id: created.spreadsheetId, name: created.title }, ...prev]);
      setSelectedId(created.spreadsheetId);
      setSelectedTitle(created.title);
      setTabs(created.sheets);
      setSelectedTab(created.sheets[0] || 'Leads');
      onNotify('success', `Created spreadsheet "${created.title}"`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create Google Spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSync = async () => {
    const token = getCachedWorkspaceToken();
    if (!token) {
      setError('Session token expired. Please reconnect Google Sheets.');
      return;
    }
    setSyncing(true);
    setError('');
    try {
      await onSaveSheetConfig({
        googleSheetId: selectedId,
        googleSheetTitle: selectedTitle || 'Workshop Leads Sheet',
        googleSheetTabName: selectedTab || 'Leads',
      });
      const result = await syncLeadsToGoogleSheet({
        accessToken: token,
        spreadsheetId: selectedId,
        sheetTabName: selectedTab || 'Leads',
        leads: leadsToSync,
      });
      onNotify(
        'success',
        `Google Sheets synced: ${result.appended} appended, ${result.updated} updated (${result.skippedDuplicates} duplicates skipped).`
      );
      setConfirmOpen(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google Sheets sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-lg w-full shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Table2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Google Sheets Live Sync
              </h3>
              <p className="text-xs text-[#6B645B]">
                Push, append new rows, and update existing leads without duplicates
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

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!hasToken ? (
            <div className="p-5 rounded-xl border border-[#E7E2D8] bg-[#FBF9F5] text-center space-y-3">
              <p className="text-sm font-semibold text-[#1E1C1A]">
                Authorize Google Sheets Access
              </p>
              <p className="text-xs text-[#6B645B] leading-relaxed">
                Grant temporary session permission to browse your Google Spreadsheets and synchronize{' '}
                <span className="font-mono font-semibold">{leadsToSync.length}</span> lead(s).
              </p>
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={loading}
                className="px-4 py-2.5 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Connect Google Account for Sheets</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Google Sheets session active
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshList}
                    disabled={loading}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-[#D6D0C4] rounded-lg bg-white hover:bg-[#F8F7F4] flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    <span>Load Sheets</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNewSheet}
                    disabled={loading}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-[#B08942] text-[#9A7230] rounded-lg bg-[#FBF9F5] hover:bg-[#F1EDE4] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Sheet</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                  Target Google Spreadsheet
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => handleSelectSheet(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg"
                >
                  <option value="">Select a spreadsheet...</option>
                  {selectedId && !spreadsheets.some((s) => s.id === selectedId) && (
                    <option value={selectedId}>{selectedTitle || selectedId}</option>
                  )}
                  {spreadsheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                  Sheet Tab Name
                </label>
                {tabs.length > 0 ? (
                  <select
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg"
                  >
                    {tabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    placeholder="Leads"
                    className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                  />
                )}
              </div>

              {confirmOpen && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                  <p className="text-xs font-semibold text-amber-950">
                    Confirm Google Sheets Update
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    This will write and update <span className="font-mono font-semibold">{leadsToSync.length}</span>{' '}
                    lead record(s) in spreadsheet <span className="font-semibold">&ldquo;{selectedTitle || selectedId}&rdquo;</span> (tab <span className="font-mono">{selectedTab}</span>). Matching rows by Lead ID or phone number will be updated in place; new leads will be appended.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#57514A] bg-white border border-[#D6D0C4] rounded-lg"
          >
            Cancel
          </button>
          {hasToken && !confirmOpen && (
            <button
              type="button"
              disabled={!selectedId || !selectedTab || leadsToSync.length === 0}
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E1C1A] hover:bg-[#322D28] rounded-lg disabled:opacity-50"
            >
              Review &amp; Push {leadsToSync.length} Leads
            </button>
          )}
          {hasToken && confirmOpen && (
            <button
              type="button"
              disabled={syncing}
              onClick={handleExecuteSync}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {syncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{syncing ? 'Syncing...' : 'Confirm & Sync Now'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
