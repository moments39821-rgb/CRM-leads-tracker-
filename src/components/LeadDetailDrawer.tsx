import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Clock,
  MapPin,
  Calendar,
  FileText,
  Trash2,
  CheckCircle2,
  Tag,
  Globe,
  Send,
  History,
} from 'lucide-react';
import type {
  ContactStatus,
  Lead,
  LeadActivity,
  LeadPriority,
  RegistrationStatus,
} from '../types/crm';
import { CONTACT_STATUSES, QUICK_NOTE_PRESETS } from '../types/crm';
import {
  buildTelUrl,
  formatDurationSeconds,
  normalizePhoneNumber,
  parseDurationToSeconds,
} from '../utils/phone';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  activities: LeadActivity[];
  defaultCountryCode: string;
  canDelete: boolean;
  onClose: () => void;
  onUpdateLead: (
    leadId: string,
    updates: Partial<Lead>,
    activityTitle?: string
  ) => Promise<void>;
  onAddNote: (lead: Lead, noteText: string) => Promise<void>;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenCall: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => Promise<void>;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  activities,
  defaultCountryCode,
  canDelete,
  onClose,
  onUpdateLead,
  onAddNote,
  onOpenWhatsApp,
  onOpenCall,
  onDeleteLead,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ContactStatus>('New Lead');
  const [regStatus, setRegStatus] = useState<RegistrationStatus>('Pending');
  const [priority, setPriority] = useState<LeadPriority>('Warm');
  const [durationStr, setDurationStr] = useState('00:00');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.applicantName);
      setLocation(lead.location || '');
      setStatus(lead.contactStatus);
      setRegStatus(lead.registrationStatus);
      setPriority(lead.priority);
      setDurationStr(formatDurationSeconds(lead.callDurationSeconds));
      setFollowUpDate(lead.followUpDate || '');
      setFollowUpTime(lead.followUpTime || '');
      setFollowUpNotes(lead.followUpNotes || '');
      setNewNote('');
      setConfirmDelete(false);
    }
  }, [lead]);

  if (!lead) return null;

  const { display } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
  const telUrl = buildTelUrl(lead.phoneNumber, defaultCountryCode);
  const leadActivities = activities
    .filter((a) => a.leadId === lead.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const secs = parseDurationToSeconds(durationStr);
      await onUpdateLead(
        lead.id,
        {
          applicantName: name.trim() || lead.applicantName,
          location: location.trim(),
          contactStatus: status,
          registrationStatus: regStatus,
          priority,
          callDurationSeconds: secs,
          followUpDate,
          followUpTime,
          followUpNotes: followUpNotes.trim(),
        },
        'Lead details updated'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitNote = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onAddNote(lead, trimmed);
    setNewNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-[#E7E2D8] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#6B645B] mb-1">
              <span className="font-mono tabular-nums">#{lead.serialNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{lead.leadSource}</span>
              {lead.importedFrom && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[180px]" title={lead.importedFrom}>
                    {lead.importedFrom}
                  </span>
                </>
              )}
            </div>
            <h2 className="font-display text-xl font-semibold text-[#1E1C1A] truncate">
              {lead.applicantName}
            </h2>
            <p className="text-sm font-mono tabular-nums text-[#57514A] mt-0.5">{display}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={telUrl}
              onClick={() => onOpenCall(lead)}
              className="px-3 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-[#D4AF6A]" />
              <span>Call</span>
            </a>
            <button
              type="button"
              onClick={() => onOpenWhatsApp(lead)}
              className="px-3 py-2 rounded-lg bg-[#128C7E] hover:bg-[#0E7468] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#78716C] hover:text-[#1E1C1A] hover:bg-[#F1EDE4]"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Core Profile Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Applicant Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#9A7230]" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City / District"
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Contact Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Registration Status
              </label>
              <select
                value={regStatus}
                onChange={(e) => setRegStatus(e.target.value as RegistrationStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                <option value="Pending">Pending</option>
                <option value="Registered">Registered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Priority Indicator
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#9A7230]" />
                <span>Call Duration (MM:SS)</span>
              </label>
              <input
                type="text"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="04:30"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#9A7230]" />
                <span>Follow-up Date</span>
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Follow-up Time
              </label>
              <input
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A443D] mb-1">
              Follow-up Instructions
            </label>
            <input
              type="text"
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              placeholder="Next action for scheduled follow-up..."
              className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#6B645B]">
              Created {new Date(lead.createdAt).toLocaleString('en-IN')}
            </span>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF6A]" />
              <span>{saving ? 'Saving...' : 'Save Lead Changes'}</span>
            </button>
          </div>

          {/* Campaign & Attribution Metadata */}
          <div className="p-4 rounded-xl bg-[#F8F7F4] border border-[#E7E2D8] space-y-2">
            <h4 className="text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#9A7230]" />
              <span>Campaign &amp; Attribution Details</span>
            </h4>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
              <div>
                <span className="text-[#6B645B]">Campaign: </span>
                <span className="font-medium text-[#1E1C1A]">{lead.campaignName || '—'}</span>
              </div>
              <div>
                <span className="text-[#6B645B]">UTM Source: </span>
                <span className="font-mono text-[#1E1C1A]">{lead.utmSource || '—'}</span>
              </div>
              <div>
                <span className="text-[#6B645B]">UTM Medium: </span>
                <span className="font-mono text-[#1E1C1A]">{lead.utmMedium || '—'}</span>
              </div>
              <div>
                <span className="text-[#6B645B]">GCLID: </span>
                <span className="font-mono text-[#1E1C1A] break-all">{lead.gclid || '—'}</span>
              </div>
              {lead.importedFrom && (
                <div className="col-span-2">
                  <span className="text-[#6B645B]">Existing File Source: </span>
                  <span className="font-mono text-[#1E1C1A]">{lead.importedFrom}</span>
                </div>
              )}
            </div>
          </div>

          {/* Add Note + Presets */}
          <div className="space-y-2.5 pt-2 border-t border-[#E7E2D8]">
            <h4 className="text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#9A7230]" />
              <span>Add Quick Note</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSubmitNote(preset)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E7E2D8] bg-[#FBF9F5] hover:border-[#B08942] text-[#4A443D] transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitNote(newNote);
                  }
                }}
                placeholder="Write a custom follow-up note..."
                className="flex-1 px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
              <button
                type="button"
                onClick={() => handleSubmitNote(newNote)}
                disabled={!newNote.trim()}
                className="px-3.5 py-2 rounded-lg bg-[#B08942] hover:bg-[#9A7230] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            {lead.notes && (
              <div className="p-3 rounded-lg bg-[#FBF9F5] border border-[#E7E2D8] text-xs text-[#4A443D] whitespace-pre-wrap">
                {lead.notes}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3 pt-2 border-t border-[#E7E2D8]">
            <h4 className="text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#9A7230]" />
              <span>Activity Timeline ({leadActivities.length})</span>
            </h4>
            {leadActivities.length === 0 ? (
              <p className="text-xs text-[#78716C]">No activity events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {leadActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 pb-3 border-b border-[#F1EDE4] last:border-b-0"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#B08942] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#1E1C1A]">{act.title}</p>
                      {act.description && (
                        <p className="text-xs text-[#57514A] mt-0.5">{act.description}</p>
                      )}
                      <p className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                        {new Date(act.createdAt).toLocaleString('en-IN')} · {act.performedBy || 'System'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Delete Control */}
        {canDelete && (
          <div className="px-6 py-3.5 border-t border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Lead Record</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 w-full justify-between">
                <span className="text-xs font-semibold text-red-800">
                  Permanently delete {lead.applicantName}?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D6D0C4] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLead(lead)}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
