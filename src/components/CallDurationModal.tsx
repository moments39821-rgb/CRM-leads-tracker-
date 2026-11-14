import React, { useState, useEffect } from 'react';
import { Phone, Clock, X, Play, Square, Check } from 'lucide-react';
import type { ContactStatus, Lead } from '../types/crm';
import { CONTACT_STATUSES } from '../types/crm';
import {
  buildTelUrl,
  formatDurationSeconds,
  normalizePhoneNumber,
  parseDurationToSeconds,
} from '../utils/phone';

interface CallDurationModalProps {
  lead: Lead | null;
  mode: 'call' | 'edit-duration';
  defaultCountryCode: string;
  onClose: () => void;
  onSaveCallLog: (
    lead: Lead,
    durationSeconds: number,
    newStatus?: ContactStatus,
    note?: string
  ) => Promise<void>;
}

export const CallDurationModal: React.FC<CallDurationModalProps> = ({
  lead,
  mode,
  defaultCountryCode,
  onClose,
  onSaveCallLog,
}) => {
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualInput, setManualInput] = useState('00:00');
  const [selectedStatus, setSelectedStatus] = useState<ContactStatus>('Call Connected');
  const [callNote, setCallNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      const initialSecs = lead.callDurationSeconds || 0;
      setElapsedSeconds(initialSecs);
      setManualInput(formatDurationSeconds(initialSecs));
      setSelectedStatus(
        lead.contactStatus === 'New Lead' ? 'Call Connected' : lead.contactStatus
      );
      setCallNote('');
      setTimerRunning(mode === 'call');
    }
  }, [lead, mode]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        setManualInput(formatDurationSeconds(next));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  if (!lead) return null;

  const { display } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
  const telUrl = buildTelUrl(lead.phoneNumber, defaultCountryCode);

  const handleManualChange = (val: string) => {
    setManualInput(val);
    setTimerRunning(false);
    setElapsedSeconds(parseDurationToSeconds(val));
  };

  const handlePresetMinutes = (mins: number) => {
    setTimerRunning(false);
    const secs = mins * 60;
    setElapsedSeconds(secs);
    setManualInput(formatDurationSeconds(secs));
  };

  const handleSave = async () => {
    setSaving(true);
    setTimerRunning(false);
    try {
      const finalSecs = parseDurationToSeconds(manualInput) || elapsedSeconds;
      await onSaveCallLog(lead, finalSecs, selectedStatus, callNote.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-md w-full shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#1E1C1A] text-[#D4AF6A] flex items-center justify-center">
              {mode === 'call' ? <Phone className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                {mode === 'call' ? 'Call & Log Duration' : 'Record Call Duration'}
              </h3>
              <p className="text-xs text-[#6B645B]">
                {lead.applicantName} · <span className="font-mono tabular-nums">{display}</span>
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

        <div className="p-6 space-y-5">
          {mode === 'call' && (
            <div className="p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E7E2D8] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#1E1C1A]">Device Dialer</p>
                <p className="text-[11px] text-[#6B645B]">
                  Tap Call Now if your dialer did not open automatically.
                </p>
              </div>
              <a
                href={telUrl}
                className="px-3.5 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#D4AF6A]" />
                <span>Call Now</span>
              </a>
            </div>
          )}

          {/* Call Timer & Manual Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#4A443D]">
                Call Duration (MM:SS or HH:MM:SS)
              </label>
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  timerRunning
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-[#F1EDE4] text-[#1E1C1A] border border-[#D6D0C4]'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <span>Pause Timer</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Timer</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={manualInput}
              onChange={(e) => handleManualChange(e.target.value)}
              placeholder="03:45"
              className="w-full px-4 py-3 text-center text-2xl font-mono font-semibold tabular-nums bg-[#FBF9F5] border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
            />

            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[11px] text-[#78716C]">Quick set:</span>
              {[1, 2, 5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handlePresetMinutes(mins)}
                  className="px-2.5 py-1 text-[11px] font-mono font-medium rounded border border-[#E7E2D8] bg-[#F8F7F4] hover:border-[#B08942] text-[#1E1C1A] transition-colors"
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A443D] mb-1.5">
              Update Contact Status After Call
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ContactStatus)}
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
            <label className="block text-xs font-semibold text-[#4A443D] mb-1.5">
              Call Outcome Note (Optional)
            </label>
            <input
              type="text"
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="e.g., Explained workshop curriculum; requested fee link"
              className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
            />
          </div>

          <p className="text-[11px] text-[#78716C] leading-relaxed">
            Note: Browser security prevents automatic access to native mobile call logs; record or time your call here after returning from your dialer.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#57514A] bg-white border border-[#D6D0C4] rounded-lg hover:text-[#1E1C1A]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E1C1A] hover:bg-[#322D28] rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-[#D4AF6A]" />
            <span>{saving ? 'Saving...' : 'Save Call Duration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
