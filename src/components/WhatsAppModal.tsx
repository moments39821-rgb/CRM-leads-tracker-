import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import type { Lead, MessageTemplate } from '../types/crm';
import { DEFAULT_WHATSAPP_MESSAGE } from '../types/crm';
import { buildWhatsAppUrl, normalizePhoneNumber } from '../utils/phone';

interface WhatsAppModalProps {
  lead: Lead | null;
  templates: MessageTemplate[];
  defaultCountryCode: string;
  onClose: () => void;
  onLogInitiated: (lead: Lead, messageText: string) => Promise<void>;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  lead,
  templates,
  defaultCountryCode,
  onClose,
  onLogInitiated,
}) => {
  const defaultTemplate =
    templates.find((t) => t.isDefault) ||
    templates[0] || {
      id: 'default',
      name: 'Yantra Masterclass Welcome',
      body: DEFAULT_WHATSAPP_MESSAGE,
      isDefault: true,
    };

  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate.id);
  const [message, setMessage] = useState(defaultTemplate.body);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      const tpl = templates.find((t) => t.isDefault) || templates[0];
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        setMessage(tpl.body);
      } else {
        setMessage(DEFAULT_WHATSAPP_MESSAGE);
      }
    }
  }, [lead, templates]);

  if (!lead) return null;

  const { display, digitsOnly } = normalizePhoneNumber(lead.phoneNumber, defaultCountryCode);
  const whatsappUrl = buildWhatsAppUrl(lead.phoneNumber, message, defaultCountryCode);

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setMessage(tpl.body);
    }
  };

  const handleOpenWhatsApp = async () => {
    setSubmitting(true);
    try {
      await onLogInitiated(lead, message);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white border border-[#E7E2D8] rounded-xl max-w-lg w-full shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E7E2D8] flex items-center justify-between bg-[#FBF9F5]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center text-[#128C7E]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.453 1.344-2 1.422-.531.078-1.203.109-1.938-.125-.453-.141-1.031-.328-1.766-.641-3.094-1.344-5.109-4.469-5.266-4.672-.156-.203-1.25-1.656-1.25-3.156 0-1.5.781-2.234 1.063-2.547.281-.313.609-.391.813-.391.203 0 .406 0 .578.016.188.016.438-.078.688.516.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.109.203-.156.344-.313.516-.156.172-.328.391-.469.516-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5.313.156.484.125.672-.078.188-.203.766-.891.969-1.203.203-.313.406-.25.688-.156.281.094 1.781.844 2.078 1 .297.156.5.219.578.344.078.125.078.734-.172 1.438z" />
              </svg>
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                WhatsApp Follow-Up Review
              </h3>
              <p className="text-xs text-[#6B645B]">
                {lead.applicantName} · <span className="font-mono tabular-nums">{display}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1E1C1A] hover:bg-[#F1EDE4] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1.5">
                Message Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#4A443D] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#9A7230]" />
                <span>Review &amp; Edit Message Before Opening WhatsApp</span>
              </label>
              <span className="text-[11px] font-mono text-[#78716C] tabular-nums">
                wa.me/{digitsOnly}
              </span>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942] leading-relaxed"
            />
            <p className="mt-1.5 text-[11px] text-[#78716C]">
              WhatsApp opens with this message pre-filled. You review and press Send inside WhatsApp.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#57514A] hover:text-[#1E1C1A] rounded-lg border border-[#D6D0C4] bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={submitting || !message.trim() || !digitsOnly}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#128C7E] hover:bg-[#0E7468] rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Opening...' : 'Open in WhatsApp'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
