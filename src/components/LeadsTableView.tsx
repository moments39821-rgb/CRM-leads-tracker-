import React, { useMemo, useState } from 'react';
import {
  Search,
  Copy,
  Check,
  Phone,
  Clock,
  Eye,
  Trash2,
  Download,
  FileSpreadsheet,
  Table2,
  UserPlus,
  Pencil,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  FileUp,
} from 'lucide-react';
import type {
  ContactStatus,
  Lead,
  LeadPriority,
  LeadSource,
  RegistrationStatus,
} from '../types/crm';
import { CONTACT_STATUSES, LEAD_SOURCES } from '../types/crm';
import {
  buildTelUrl,
  formatDurationSeconds,
  normalizePhoneNumber,
} from '../utils/phone';
import {
  downloadLeadsAsCsv,
  downloadLeadsAsExcel,
} from '../services/exportService';

interface LeadsTableViewProps {
  leads: Lead[];
  defaultCountryCode: string;
  initialStatusFilter?: string;
  canDelete: boolean;
  onSelectLead: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: ContactStatus) => Promise<void>;
  onPriorityChange: (lead: Lead, priority: LeadPriority) => Promise<void>;
  onInlineUpdate: (
    lead: Lead,
    updates: Partial<Lead>,
    activityTitle: string
  ) => Promise<void>;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenCall: (lead: Lead, mode: 'call' | 'edit-duration') => void;
  onDeleteLead: (lead: Lead) => Promise<void>;
  onBulkStatusUpdate: (leadIds: string[], status: ContactStatus) => Promise<void>;
  onBulkDelete: (leadIds: string[]) => Promise<void>;
  onOpenQuickAdd: () => void;
  onOpenFileMigration: () => void;
  onOpenGoogleSheetsSync: (targetLeads: Lead[]) => void;
  onLoadDemoContacts?: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type SortOption =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'name_desc'
  | 'location'
  | 'status'
  | 'duration_desc';

const STATUS_STYLE_MAP: Record<ContactStatus, string> = {
  'New Lead': 'bg-[#FBF9F5] text-[#855E1E] border-[#E0CFA9]',
  'Call Received': 'bg-sky-50 text-sky-900 border-sky-200',
  'Call Connected': 'bg-teal-50 text-teal-900 border-teal-200',
  'Call Not Received': 'bg-stone-100 text-stone-700 border-stone-300',
  'Call Denied': 'bg-rose-50 text-rose-800 border-rose-200',
  'Called Back': 'bg-indigo-50 text-indigo-900 border-indigo-200',
  'Follow-up Required': 'bg-amber-50 text-amber-900 border-amber-300',
  'Interested': 'bg-emerald-50 text-emerald-900 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-800 border-red-200',
  'Registration Confirmed': 'bg-[#1E1C1A] text-[#F2D593] border-[#1E1C1A]',
};

const PRIORITY_STYLE_MAP: Record<LeadPriority, string> = {
  Hot: 'text-red-700 bg-red-50 border-red-200',
  Warm: 'text-amber-800 bg-amber-50 border-amber-200',
  Cold: 'text-stone-600 bg-stone-100 border-stone-200',
};

export const LeadsTableView: React.FC<LeadsTableViewProps> = ({
  leads,
  defaultCountryCode,
  initialStatusFilter = 'All',
  canDelete,
  onSelectLead,
  onStatusChange,
  onPriorityChange,
  onInlineUpdate,
  onOpenWhatsApp,
  onOpenCall,
  onDeleteLead,
  onBulkStatusUpdate,
  onBulkDelete,
  onOpenQuickAdd,
  onOpenFileMigration,
  onOpenGoogleSheetsSync,
  onLoadDemoContacts,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [campaignFilter, setCampaignFilter] = useState<string>('All');
  const [regFilter, setRegFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [followUpDateFilter, setFollowUpDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: 'applicantName' | 'location';
    value: string;
  } | null>(null);

  // Export dropdown & delete confirmation
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ContactStatus>('Interested');
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const campaignOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.campaignName) set.add(l.campaignName);
    });
    return Array.from(set).sort();
  }, [leads]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      if (q) {
        const hay = [
          lead.applicantName,
          lead.phoneNumber,
          lead.normalizedPhone,
          lead.location,
          lead.campaignName,
          lead.importedFrom,
          lead.notes,
          lead.gclid,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (statusFilter !== 'All' && lead.contactStatus !== statusFilter) return false;
      if (sourceFilter !== 'All' && lead.leadSource !== (sourceFilter as LeadSource)) return false;
      if (campaignFilter !== 'All' && (lead.campaignName || '') !== campaignFilter) return false;
      if (regFilter !== 'All' && lead.registrationStatus !== (regFilter as RegistrationStatus))
        return false;
      if (priorityFilter !== 'All' && lead.priority !== (priorityFilter as LeadPriority))
        return false;

      if (dateFrom) {
        const createdDate = lead.createdAt.slice(0, 10);
        if (createdDate < dateFrom) return false;
      }
      if (dateTo) {
        const createdDate = lead.createdAt.slice(0, 10);
        if (createdDate > dateTo) return false;
      }
      if (followUpDateFilter && (lead.followUpDate || '') !== followUpDateFilter) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'name_asc':
          return a.applicantName.localeCompare(b.applicantName);
        case 'name_desc':
          return b.applicantName.localeCompare(a.applicantName);
        case 'location':
          return (a.location || '').localeCompare(b.location || '');
        case 'status':
          return a.contactStatus.localeCompare(b.contactStatus);
        case 'duration_desc':
          return (b.callDurationSeconds || 0) - (a.callDurationSeconds || 0);
        case 'newest':
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

    return sorted;
  }, [
    leads,
    search,
    statusFilter,
    sourceFilter,
    campaignFilter,
    regFilter,
    priorityFilter,
    dateFrom,
    dateTo,
    followUpDateFilter,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLeads = filteredAndSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.includes(l.id)),
    [leads, selectedIds]
  );

  const allOnPageSelected =
    pagedLeads.length > 0 && pagedLeads.every((l) => selectedIds.includes(l.id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const pageIdSet = new Set(pagedLeads.map((l) => l.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...pagedLeads.map((l) => l.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCopyPhone = async (lead: Lead) => {
    try {
      await navigator.clipboard.writeText(lead.phoneNumber);
      setCopiedId(lead.id);
      onNotify('info', `Copied ${lead.phoneNumber}`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      onNotify('error', 'Unable to copy phone number');
    }
  };

  const commitInlineEdit = async (lead: Lead) => {
    if (!editingCell || editingCell.id !== lead.id) return;
    const trimmed = editingCell.value.trim();
    const field = editingCell.field;
    setEditingCell(null);
    if (field === 'applicantName' && (!trimmed || trimmed === lead.applicantName)) return;
    if (field === 'location' && trimmed === (lead.location || '')) return;
    await onInlineUpdate(
      lead,
      { [field]: trimmed },
      field === 'applicantName' ? `Name updated to "${trimmed}"` : `Location updated to "${trimmed || 'Not specified'}"`
    );
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setSourceFilter('All');
    setCampaignFilter('All');
    setRegFilter('All');
    setPriorityFilter('All');
    setDateFrom('');
    setDateTo('');
    setFollowUpDateFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Search Toolbar */}
      <div className="bg-white border border-[#E7E2D8] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Global Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, phone, location, campaign, file..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FBF9F5] border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
            />
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showFilters
                  ? 'bg-[#1E1C1A] text-white border-[#1E1C1A]'
                  : 'bg-white text-[#1E1C1A] border-[#D6D0C4] hover:border-[#B08942]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            <button
              type="button"
              onClick={onOpenFileMigration}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#B08942] bg-[#FBF9F5] hover:bg-[#F1EDE4] text-[#7D5B22] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Insert Existing Files</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenGoogleSheetsSync(
                  selectedLeads.length > 0 ? selectedLeads : filteredAndSorted
                )
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#D6D0C4] bg-white hover:border-emerald-600 text-[#1E1C1A] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Table2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Google Sheets</span>
            </button>

            {/* Export Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#D6D0C4] bg-white hover:border-[#B08942] text-[#1E1C1A] flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#9A7230]" />
                <span>Export</span>
              </button>
              {exportOpen && (
                <div
                  onMouseLeave={() => setExportOpen(false)}
                  className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E7E2D8] rounded-xl shadow-lg z-30 py-1.5 text-xs"
                >
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-[#78716C] border-b border-[#F1EDE4]">
                    CSV &amp; Excel (.xlsx) Export
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      downloadLeadsAsCsv(filteredAndSorted, 'yantra-filtered-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported ${filteredAndSorted.length} filtered leads to CSV`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A]"
                  >
                    Download CSV (Filtered: {filteredAndSorted.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadLeadsAsExcel(filteredAndSorted, 'yantra-filtered-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported ${filteredAndSorted.length} filtered leads to Excel`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A]"
                  >
                    Download Excel .xlsx (Filtered: {filteredAndSorted.length})
                  </button>
                  <button
                    type="button"
                    disabled={selectedLeads.length === 0}
                    onClick={() => {
                      downloadLeadsAsCsv(selectedLeads, 'yantra-selected-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported ${selectedLeads.length} selected leads to CSV`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A] disabled:opacity-40"
                  >
                    Export Selected CSV ({selectedLeads.length})
                  </button>
                  <button
                    type="button"
                    disabled={selectedLeads.length === 0}
                    onClick={() => {
                      downloadLeadsAsExcel(selectedLeads, 'yantra-selected-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported ${selectedLeads.length} selected leads to Excel`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A] disabled:opacity-40"
                  >
                    Export Selected Excel ({selectedLeads.length})
                  </button>
                  <div className="border-t border-[#F1EDE4] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      downloadLeadsAsCsv(leads, 'yantra-all-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported all ${leads.length} leads to CSV`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A]"
                  >
                    Export All Leads CSV ({leads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadLeadsAsExcel(leads, 'yantra-all-leads');
                      setExportOpen(false);
                      onNotify('success', `Exported all ${leads.length} leads to Excel`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FBF9F5] font-medium text-[#1E1C1A]"
                  >
                    Export All Leads Excel ({leads.length})
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenQuickAdd}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#D4AF6A]" />
              <span>Quick Add Lead</span>
            </button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="pt-3 border-t border-[#E7E2D8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Contact Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              >
                <option value="All">All Statuses</option>
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Lead Source
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              >
                <option value="All">All Sources</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Campaign
              </label>
              <select
                value={campaignFilter}
                onChange={(e) => {
                  setCampaignFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              >
                <option value="All">All Campaigns</option>
                {campaignOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Priority / Registration
              </label>
              <div className="flex gap-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 px-2 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
                >
                  <option value="All">All Priority</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
                <select
                  value={regFilter}
                  onChange={(e) => {
                    setRegFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 px-2 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
                >
                  <option value="All">All Reg.</option>
                  <option value="Pending">Pending</option>
                  <option value="Registered">Registered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Created From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Created To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Follow-up Date
              </label>
              <input
                type="date"
                value={followUpDateFilter}
                onChange={(e) => {
                  setFollowUpDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
              />
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D6D0C4] rounded-lg"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="name_desc">Name (Z–A)</option>
                  <option value="location">Location</option>
                  <option value="status">Contact Status</option>
                  <option value="duration_desc">Longest Call Duration</option>
                </select>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 text-xs font-semibold text-[#9A7230] hover:underline whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Quick Status Filter Strip + Result Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['All', 'New Lead', 'Follow-up Required', 'Interested', 'Registration Confirmed', 'Not Interested'].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-[#1E1C1A] text-white'
                      : 'bg-[#F8F7F4] text-[#57514A] hover:text-[#1E1C1A]'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
          <span className="text-xs text-[#6B645B] tabular-nums">
            Showing {filteredAndSorted.length} of {leads.length} lead(s)
          </span>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#1E1C1A] text-white rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold tabular-nums">
              {selectedIds.length} lead(s) selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[#D4AF6A] hover:underline"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ContactStatus)}
              className="px-2.5 py-1.5 text-xs bg-[#2C2825] border border-white/20 rounded-lg text-white"
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                await onBulkStatusUpdate(selectedIds, bulkStatus);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#B08942] hover:bg-[#9A7230] text-white"
            >
              Apply Status
            </button>
            <button
              type="button"
              onClick={() => downloadLeadsAsExcel(selectedLeads, 'yantra-selected-leads')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              Export Excel
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white border border-[#E7E2D8] rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#F8F7F4] border border-[#E7E2D8] flex items-center justify-center mx-auto text-[#9A7230]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="font-display text-lg font-semibold text-[#1E1C1A]">
              {leads.length === 0 ? 'No Workshop Leads Recorded Yet' : 'No Matching Leads Found'}
            </h3>
            <p className="text-xs text-[#6B645B] mt-1.5 leading-relaxed">
              {leads.length === 0
                ? 'Capture leads automatically from the Google Ads Landing Page, migrate existing CSV/Excel/Google Sheets/PDF/Word files, or add an applicant manually.'
                : 'Try adjusting your search query or clearing active date and status filters.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {leads.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={onOpenQuickAdd}
                  className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold"
                >
                  Add First Lead
                </button>
                <button
                  type="button"
                  onClick={onOpenFileMigration}
                  className="px-4 py-2 rounded-lg border border-[#B08942] bg-[#FBF9F5] text-[#7D5B22] text-xs font-semibold"
                >
                  Insert Existing Files
                </button>
                {onLoadDemoContacts && (
                  <button
                    type="button"
                    onClick={onLoadDemoContacts}
                    className="px-4 py-2 rounded-lg border border-[#D6D0C4] bg-white hover:bg-[#FBF9F5] text-[#1E1C1A] text-xs font-semibold"
                  >
                    Load Trial Demo Contacts
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Full Data Table */}
          <div className="hidden md:block bg-white border border-[#E7E2D8] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FBF9F5] border-b border-[#E7E2D8] text-[11px] font-semibold text-[#57514A] tracking-wide">
                    <th className="py-3 pl-4 pr-2 w-9">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all leads on page"
                        className="rounded border-[#D6D0C4]"
                      />
                    </th>
                    <th className="py-3 px-2.5 whitespace-nowrap">SL. NO.</th>
                    <th className="py-3 px-3 whitespace-nowrap">APPLICANT NAME</th>
                    <th className="py-3 px-3 whitespace-nowrap">PHONE NUMBER</th>
                    <th className="py-3 px-3 whitespace-nowrap">LOCATION</th>
                    <th className="py-3 px-3 whitespace-nowrap">DATE &amp; TIME</th>
                    <th className="py-3 px-3 whitespace-nowrap">LEAD SOURCE</th>
                    <th className="py-3 px-3 whitespace-nowrap">CAMPAIGN NAME</th>
                    <th className="py-3 px-3 whitespace-nowrap">EXISTING FILES</th>
                    <th className="py-3 px-3 whitespace-nowrap">CALL DURATION</th>
                    <th className="py-3 px-3 whitespace-nowrap">CONTACT STATUS</th>
                    <th className="py-3 px-3 whitespace-nowrap text-center">FOLLOW-UP</th>
                    <th className="py-3 pl-2 pr-4 whitespace-nowrap text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E2D8] text-xs">
                  {pagedLeads.map((lead, idx) => {
                    const sl = (safePage - 1) * pageSize + idx + 1;
                    const { display } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
                    const telUrl = buildTelUrl(lead.phoneNumber, defaultCountryCode);
                    const dt = new Date(lead.createdAt);
                    const datePart = dt.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    });
                    const timePart = dt.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-[#FBF9F5]/80 transition-colors group"
                      >
                        <td className="py-3 pl-4 pr-2 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => toggleOne(lead.id)}
                            aria-label={`Select ${lead.applicantName}`}
                            className="rounded border-[#D6D0C4]"
                          />
                        </td>

                        <td className="py-3 px-2.5 align-middle font-mono tabular-nums text-[#6B645B]">
                          {lead.serialNumber || sl}
                        </td>

                        {/* Applicant Name + Inline Edit + Priority */}
                        <td className="py-3 px-3 align-middle min-w-[175px]">
                          {editingCell?.id === lead.id && editingCell.field === 'applicantName' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({ ...editingCell, value: e.target.value })
                              }
                              onBlur={() => commitInlineEdit(lead)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineEdit(lead);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#B08942] rounded bg-white focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectLead(lead)}
                                className="font-semibold text-[#1E1C1A] hover:text-[#9A7230] text-left truncate max-w-[140px]"
                              >
                                {lead.applicantName}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCell({
                                    id: lead.id,
                                    field: 'applicantName',
                                    value: lead.applicantName,
                                  })
                                }
                                title="Edit applicant name"
                                className="opacity-0 group-hover:opacity-100 text-[#78716C] hover:text-[#1E1C1A] p-0.5 transition-opacity"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <select
                              value={lead.priority}
                              onChange={(e) =>
                                onPriorityChange(lead, e.target.value as LeadPriority)
                              }
                              aria-label="Lead priority"
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer ${
                                PRIORITY_STYLE_MAP[lead.priority]
                              }`}
                            >
                              <option value="Hot">Hot</option>
                              <option value="Warm">Warm</option>
                              <option value="Cold">Cold</option>
                            </select>
                            {lead.registrationStatus === 'Registered' && (
                              <span className="text-[10px] font-semibold text-emerald-800">
                                Registered
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Phone Number + Copy */}
                        <td className="py-3 px-3 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono tabular-nums font-medium text-[#1E1C1A]">
                              {display}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(lead)}
                              title="Copy phone number"
                              className="p-1 rounded hover:bg-[#F1EDE4] text-[#6B645B] hover:text-[#1E1C1A]"
                            >
                              {copiedId === lead.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Location + Inline Edit */}
                        <td className="py-3 px-3 align-middle min-w-[130px]">
                          {editingCell?.id === lead.id && editingCell.field === 'location' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({ ...editingCell, value: e.target.value })
                              }
                              onBlur={() => commitInlineEdit(lead)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineEdit(lead);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#B08942] rounded bg-white focus:outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCell({
                                  id: lead.id,
                                  field: 'location',
                                  value: lead.location || '',
                                })
                              }
                              className="text-left text-[#4A443D] hover:text-[#1E1C1A] flex items-center gap-1 group/loc"
                            >
                              <span className="truncate max-w-[130px]">
                                {lead.location || 'Add location'}
                              </span>
                              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/loc:opacity-100 text-[#9A7230]" />
                            </button>
                          )}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-3 align-middle whitespace-nowrap font-mono tabular-nums">
                          <div className="text-[#1E1C1A]">{datePart}</div>
                          <div className="text-[11px] text-[#78716C]">{timePart}</div>
                        </td>

                        {/* Lead Source */}
                        <td className="py-3 px-3 align-middle">
                          <div className="font-medium text-[#1E1C1A] whitespace-nowrap">
                            {lead.leadSource}
                          </div>
                          {(lead.gclid || lead.utmSource) && (
                            <div
                              className="text-[10px] font-mono text-[#78716C] truncate max-w-[130px]"
                              title={lead.gclid || lead.utmSource}
                            >
                              {lead.gclid ? `GCLID: ${lead.gclid}` : `utm: ${lead.utmSource}`}
                            </div>
                          )}
                        </td>

                        {/* Campaign Name */}
                        <td className="py-3 px-3 align-middle">
                          <span
                            className="text-[#4A443D] truncate block max-w-[155px]"
                            title={lead.campaignName}
                          >
                            {lead.campaignName || '—'}
                          </span>
                        </td>

                        {/* Existing Files / Migration Column */}
                        <td className="py-3 px-3 align-middle">
                          {lead.importedFrom ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#F8F7F4] border border-[#E7E2D8] text-[11px] font-mono text-[#4A443D] max-w-[145px] truncate"
                              title={lead.importedFrom}
                            >
                              <FileSpreadsheet className="w-3 h-3 text-[#9A7230] shrink-0" />
                              <span className="truncate">{lead.importedFrom}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={onOpenFileMigration}
                              className="text-[11px] text-[#78716C] hover:text-[#9A7230] hover:underline whitespace-nowrap"
                            >
                              + Insert File
                            </button>
                          )}
                        </td>

                        {/* Call Duration Column */}
                        <td className="py-3 px-3 align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenCall(lead, 'edit-duration')}
                            title="Record or edit call duration"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E7E2D8] bg-[#FBF9F5] hover:border-[#B08942] font-mono tabular-nums text-xs text-[#1E1C1A] transition-colors"
                          >
                            <Clock className="w-3 h-3 text-[#9A7230]" />
                            <span>
                              {lead.callDurationSeconds > 0
                                ? formatDurationSeconds(lead.callDurationSeconds)
                                : '00:00'}
                            </span>
                          </button>
                        </td>

                        {/* Contact Status Dropdown */}
                        <td className="py-3 px-3 align-middle">
                          <select
                            value={lead.contactStatus}
                            onChange={(e) =>
                              onStatusChange(lead, e.target.value as ContactStatus)
                            }
                            aria-label={`Contact status for ${lead.applicantName}`}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer focus:outline-none ${
                              STATUS_STYLE_MAP[lead.contactStatus]
                            }`}
                          >
                            {CONTACT_STATUSES.map((st) => (
                              <option
                                key={st}
                                value={st}
                                className="bg-white text-[#1E1C1A]"
                              >
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Smart Follow-up Column: Official WhatsApp + Prominent Call */}
                        <td className="py-3 px-3 align-middle">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenWhatsApp(lead)}
                              title="Send WhatsApp Message"
                              className="w-9 h-9 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] flex items-center justify-center transition-colors"
                            >
                              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                                <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.453 1.344-2 1.422-.531.078-1.203.109-1.938-.125-.453-.141-1.031-.328-1.766-.641-3.094-1.344-5.109-4.469-5.266-4.672-.156-.203-1.25-1.656-1.25-3.156 0-1.5.781-2.234 1.063-2.547.281-.313.609-.391.813-.391.203 0 .406 0 .578.016.188.016.438-.078.688.516.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.109.203-.156.344-.313.516-.156.172-.328.391-.469.516-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5.313.156.484.125.672-.078.188-.203.766-.891.969-1.203.203-.313.406-.25.688-.156.281.094 1.781.844 2.078 1 .297.156.5.219.578.344.078.125.078.734-.172 1.438z" />
                              </svg>
                            </button>
                            <a
                              href={telUrl}
                              onClick={() => onOpenCall(lead, 'call')}
                              title={`Call ${display}`}
                              className="w-9 h-9 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-[#D4AF6A] flex items-center justify-center transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 pl-2 pr-4 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              title="View profile & schedule follow-up"
                              className="p-1.5 rounded-lg text-[#57514A] hover:text-[#1E1C1A] hover:bg-[#F1EDE4]"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              title="Schedule follow-up"
                              className="p-1.5 rounded-lg text-[#57514A] hover:text-[#9A7230] hover:bg-[#F1EDE4]"
                            >
                              <CalendarPlus className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(lead)}
                                title="Delete lead"
                                className="p-1.5 rounded-lg text-[#78716C] hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Lead Cards */}
          <div className="md:hidden space-y-3">
            {pagedLeads.map((lead, idx) => {
              const sl = (safePage - 1) * pageSize + idx + 1;
              const { display } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
              const telUrl = buildTelUrl(lead.phoneNumber, defaultCountryCode);
              return (
                <div
                  key={lead.id}
                  className="bg-white border border-[#E7E2D8] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-[#6B645B]">
                        <span className="font-mono tabular-nums">#{lead.serialNumber || sl}</span>
                        <span>·</span>
                        <span>{lead.priority}</span>
                        <span>·</span>
                        <span className="truncate">{lead.leadSource}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="font-display text-base font-semibold text-[#1E1C1A] mt-0.5 text-left"
                      >
                        {lead.applicantName}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono tabular-nums text-[#57514A]">
                          {display}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(lead)}
                          className="p-1 text-[#78716C]"
                          aria-label="Copy phone number"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCall(lead, 'edit-duration')}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] font-mono text-xs tabular-nums flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3 text-[#9A7230]" />
                      <span>{formatDurationSeconds(lead.callDurationSeconds)}</span>
                    </button>
                  </div>

                  <div className="text-xs text-[#6B645B] flex flex-wrap gap-x-3 gap-y-1">
                    <span>{lead.location || 'Location pending'}</span>
                    {lead.campaignName && <span>· {lead.campaignName}</span>}
                    {lead.importedFrom && <span>· File: {lead.importedFrom}</span>}
                  </div>

                  <select
                    value={lead.contactStatus}
                    onChange={(e) => onStatusChange(lead, e.target.value as ContactStatus)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold ${
                      STATUS_STYLE_MAP[lead.contactStatus]
                    }`}
                  >
                    {CONTACT_STATUSES.map((st) => (
                      <option key={st} value={st} className="bg-white text-[#1E1C1A]">
                        {st}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenWhatsApp(lead)}
                      className="h-11 rounded-lg bg-[#128C7E] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <span>WhatsApp</span>
                    </button>
                    <a
                      href={telUrl}
                      onClick={() => onOpenCall(lead, 'call')}
                      className="h-11 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#D4AF6A]" />
                      <span>Call</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onSelectLead(lead)}
                      className="h-11 rounded-lg border border-[#D6D0C4] bg-[#FBF9F5] text-[#1E1C1A] text-xs font-semibold"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-[#E7E2D8] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#57514A]">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 border border-[#D6D0C4] rounded bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[#57514A] tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#D6D0C4] bg-white disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#D6D0C4] bg-white disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
          <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-sm w-full p-6 shadow-lg space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Delete Workshop Lead?
            </h3>
            <p className="text-xs text-[#57514A] leading-relaxed">
              This will permanently remove <strong>{deleteTarget.applicantName}</strong> (
              <span className="font-mono">{deleteTarget.phoneNumber}</span>) and their activity history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 text-xs font-semibold border border-[#D6D0C4] rounded-lg bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  await onDeleteLead(target);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
          <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-sm w-full p-6 shadow-lg space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Delete {selectedIds.length} Selected Lead(s)?
            </h3>
            <p className="text-xs text-[#57514A] leading-relaxed">
              This action permanently deletes the selected leads from the CRM database and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="px-3.5 py-2 text-xs font-semibold border border-[#D6D0C4] rounded-lg bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ids = [...selectedIds];
                  setConfirmBulkDelete(false);
                  setSelectedIds([]);
                  await onBulkDelete(ids);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
