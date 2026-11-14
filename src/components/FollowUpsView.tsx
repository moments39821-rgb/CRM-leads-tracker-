import React, { useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Phone,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import type { Lead } from '../types/crm';
import { buildTelUrl, formatDurationSeconds, normalizePhoneNumber } from '../utils/phone';

interface FollowUpsViewProps {
  leads: Lead[];
  defaultCountryCode: string;
  onSelectLead: (lead: Lead) => void;
  onMarkCompleted: (lead: Lead) => Promise<void>;
  onScheduleFollowUp: (
    lead: Lead,
    date: string,
    time: string,
    notes: string
  ) => Promise<void>;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenCall: (lead: Lead) => void;
}

type QueueTab = 'overdue' | 'today' | 'upcoming' | 'completed';

const PRIORITY_WEIGHT = { Hot: 0, Warm: 1, Cold: 2 };

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  leads,
  defaultCountryCode,
  onSelectLead,
  onMarkCompleted,
  onScheduleFollowUp,
  onOpenWhatsApp,
  onOpenCall,
}) => {
  const [activeTab, setActiveTab] = useState<QueueTab>('today');
  const [rescheduleTarget, setRescheduleTarget] = useState<Lead | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);

  const buckets = useMemo(() => {
    const sortFn = (a: Lead, b: Lead) => {
      const pDiff = (PRIORITY_WEIGHT[a.priority] ?? 1) - (PRIORITY_WEIGHT[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      const dtA = `${a.followUpDate || '9999-99-99'} ${a.followUpTime || '23:59'}`;
      const dtB = `${b.followUpDate || '9999-99-99'} ${b.followUpTime || '23:59'}`;
      return dtA.localeCompare(dtB);
    };

    const withDate = leads.filter((l) => Boolean(l.followUpDate));
    const overdue = withDate
      .filter((l) => !l.followUpCompleted && (l.followUpDate || '') < todayStr)
      .sort(sortFn);
    const today = withDate
      .filter((l) => !l.followUpCompleted && l.followUpDate === todayStr)
      .sort(sortFn);
    const upcoming = withDate
      .filter((l) => !l.followUpCompleted && (l.followUpDate || '') > todayStr)
      .sort(sortFn);
    const completed = withDate.filter((l) => Boolean(l.followUpCompleted)).sort(sortFn);

    const totalScheduled = withDate.length;
    const completionRate =
      totalScheduled > 0 ? Math.round((completed.length / totalScheduled) * 100) : 0;

    return { overdue, today, upcoming, completed, totalScheduled, completionRate };
  }, [leads, todayStr]);

  const activeList = buckets[activeTab];

  const openReschedule = (lead: Lead) => {
    setRescheduleTarget(lead);
    setNewDate(lead.followUpDate || todayStr);
    setNewTime(lead.followUpTime || '11:00');
    setNewNotes(lead.followUpNotes || '');
  };

  return (
    <div className="space-y-5">
      {/* Follow-up Completion Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7E2D8] rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Follow-ups</span>
          </p>
          <p className="font-display text-2xl font-semibold text-[#1E1C1A] tabular-nums mt-1">
            {buckets.overdue.length}
          </p>
        </div>

        <div className="bg-white border border-[#E7E2D8] rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Due Today</span>
          </p>
          <p className="font-display text-2xl font-semibold text-[#1E1C1A] tabular-nums mt-1">
            {buckets.today.length}
          </p>
        </div>

        <div className="bg-white border border-[#E7E2D8] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#57514A] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#9A7230]" />
            <span>Upcoming</span>
          </p>
          <p className="font-display text-2xl font-semibold text-[#1E1C1A] tabular-nums mt-1">
            {buckets.upcoming.length}
          </p>
        </div>

        <div className="bg-white border border-[#E7E2D8] rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completion Rate</span>
          </p>
          <p className="font-display text-2xl font-semibold text-[#1E1C1A] tabular-nums mt-1">
            {buckets.completionRate}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-[#E7E2D8] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center gap-2">
          {(
            [
              ['overdue', `Overdue (${buckets.overdue.length})`],
              ['today', `Today (${buckets.today.length})`],
              ['upcoming', `Upcoming (${buckets.upcoming.length})`],
              ['completed', `Completed (${buckets.completed.length})`],
            ] as Array<[QueueTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'bg-[#1E1C1A] text-white'
                  : 'bg-white text-[#57514A] border border-[#E7E2D8] hover:text-[#1E1C1A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeList.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#6B645B]">
            No follow-ups in this category. Open any lead in the Lead Management Table to schedule a follow-up date and time.
          </div>
        ) : (
          <div className="divide-y divide-[#E7E2D8]">
            {activeList.map((lead) => {
              const { display } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
              const telUrl = buildTelUrl(lead.phoneNumber, defaultCountryCode);

              return (
                <div
                  key={lead.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FBF9F5]/70"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          lead.priority === 'Hot'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : lead.priority === 'Warm'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                      >
                        {lead.priority}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="font-display text-sm font-semibold text-[#1E1C1A] hover:text-[#9A7230]"
                      >
                        {lead.applicantName}
                      </button>
                      <span className="font-mono tabular-nums text-[#57514A]">{display}</span>
                      <span className="text-[#78716C]">· {lead.contactStatus}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B645B]">
                      <span className="font-mono tabular-nums font-medium text-[#1E1C1A]">
                        Scheduled: {lead.followUpDate} {lead.followUpTime || ''}
                      </span>
                      <span>· Call Duration: {formatDurationSeconds(lead.callDurationSeconds)}</span>
                      {lead.followUpNotes && <span>· &ldquo;{lead.followUpNotes}&rdquo;</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenWhatsApp(lead)}
                      className="px-3 py-2 rounded-lg bg-[#128C7E] hover:bg-[#0E7468] text-white text-xs font-semibold"
                    >
                      WhatsApp
                    </button>
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
                      onClick={() => openReschedule(lead)}
                      className="px-3 py-2 rounded-lg border border-[#D6D0C4] bg-white hover:border-[#B08942] text-xs font-semibold text-[#1E1C1A]"
                    >
                      Reschedule
                    </button>
                    {!lead.followUpCompleted && (
                      <button
                        type="button"
                        onClick={() => onMarkCompleted(lead)}
                        className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
          <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-md w-full p-6 shadow-lg space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Reschedule Follow-up — {rescheduleTarget.applicantName}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Follow-up Note
              </label>
              <textarea
                rows={3}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 text-xs font-semibold border border-[#D6D0C4] rounded-lg bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = rescheduleTarget;
                  setRescheduleTarget(null);
                  await onScheduleFollowUp(target, newDate, newTime, newNotes);
                }}
                className="px-4 py-2 text-xs font-semibold bg-[#1E1C1A] text-white rounded-lg"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
