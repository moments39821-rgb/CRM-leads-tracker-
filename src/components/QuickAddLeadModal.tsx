import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import type { ContactStatus, LeadPriority, LeadSource } from '../types/crm';
import { CONTACT_STATUSES, LEAD_SOURCES } from '../types/crm';
import { parseDurationToSeconds } from '../utils/phone';

interface QuickAddLeadModalProps {
  open: boolean;
  campaignNames: string[];
  onClose: () => void;
  onCreate: (data: {
    applicantName: string;
    phoneNumber: string;
    location: string;
    leadSource: LeadSource;
    campaignName: string;
    contactStatus: ContactStatus;
    priority: LeadPriority;
    callDurationSeconds: number;
    followUpDate: string;
    followUpTime: string;
    notes: string;
  }) => Promise<void>;
}

export const QuickAddLeadModal: React.FC<QuickAddLeadModalProps> = ({
  open,
  campaignNames,
  onClose,
  onCreate,
}) => {
  const [applicantName, setApplicantName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource>('Manual Entry');
  const [campaignName, setCampaignName] = useState('');
  const [contactStatus, setContactStatus] = useState<ContactStatus>('New Lead');
  const [priority, setPriority] = useState<LeadPriority>('Warm');
  const [durationStr, setDurationStr] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!applicantName.trim() || applicantName.trim().length < 2) {
      setError('Please enter the applicant full name.');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        applicantName: applicantName.trim(),
        phoneNumber: phoneNumber.trim(),
        location: location.trim(),
        leadSource,
        campaignName: campaignName.trim(),
        contactStatus,
        priority,
        callDurationSeconds: parseDurationToSeconds(durationStr),
        followUpDate,
        followUpTime,
        notes: notes.trim(),
      });
      setApplicantName('');
      setPhoneNumber('');
      setLocation('');
      setCampaignName('');
      setDurationStr('');
      setFollowUpDate('');
      setFollowUpTime('');
      setNotes('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to add lead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-xl w-full shadow-lg overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#1E1C1A] text-[#D4AF6A] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Add Workshop Lead
              </h3>
              <p className="text-xs text-[#6B645B]">
                Manual entry with automatic phone normalization &amp; duplicate check
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1E1C1A] hover:bg-[#F1EDE4]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Applicant Full Name *
              </label>
              <input
                type="text"
                required
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="e.g., Rohan Kulkarni"
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 9820411290 or +91..."
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Pune, Maharashtra"
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Lead Source
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                list="campaign-suggestions"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Yantra Masterclass – Search"
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
              <datalist id="campaign-suggestions">
                {campaignNames.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Contact Status
              </label>
              <select
                value={contactStatus}
                onChange={(e) => setContactStatus(e.target.value as ContactStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                {CONTACT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Priority Level
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
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Initial Call Duration (MM:SS)
              </label>
              <input
                type="text"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="e.g., 02:30"
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Follow-up Date
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
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any enquiry context or family discussion notes..."
              className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
            />
          </div>

          <div className="pt-3 border-t border-[#E7E2D8] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#57514A] bg-white border border-[#D6D0C4] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E1C1A] hover:bg-[#322D28] rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
