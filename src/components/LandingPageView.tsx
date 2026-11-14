import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Phone,
  User,
  Tag,
} from 'lucide-react';
import { BrandMark, SriYantraHairline } from './BrandMark';

interface LandingPageViewProps {
  instituteName: string;
  workshopName: string;
  logoDataUrl?: string;
  privacyPolicyText: string;
  onBackToCrm: () => void;
  backLabel?: string;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  instituteName,
  workshopName,
  logoDataUrl,
  privacyPolicyText,
  onBackToCrm,
  backLabel = 'Back to CRM',
}) => {
  const [applicantName, setApplicantName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  const [utmSource, setUtmSource] = useState('google');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('Yantra Masterclass – Search India');
  const [gclid, setGclid] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('utm_source');
    const med = params.get('utm_medium');
    const cmp = params.get('utm_campaign');
    const gcl = params.get('gclid');
    if (src) setUtmSource(src);
    if (med) setUtmMedium(med);
    if (cmp) setUtmCampaign(cmp);
    if (gcl) setGclid(gcl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setResultMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/leads/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          phoneNumber,
          location,
          notes,
          consentGiven,
          utmSource,
          utmMedium,
          utmCampaign,
          campaignName: utmCampaign || 'Yantra Masterclass – Search India',
          gclid: gclid || `GCLID_${Date.now().toString(36).toUpperCase()}`,
          leadSource: 'Google Ads Landing Page',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed.');
      }
      setResultMsg(data.message);
      setApplicantName('');
      setPhoneNumber('');
      setLocation('');
      setNotes('');
      setConsentGiven(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E7E2D8] px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark logoDataUrl={logoDataUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-[#9A7230] uppercase truncate">
              {instituteName}
            </p>
            <p className="font-display text-sm font-semibold text-[#1E1C1A] truncate">
              {workshopName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToCrm}
          className="px-3.5 py-2 rounded-lg border border-[#D6D0C4] bg-[#FBF9F5] hover:border-[#B08942] text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Workshop Editorial Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="relative p-6 rounded-xl bg-[#1E1C1A] text-white overflow-hidden">
            <SriYantraHairline className="absolute -right-6 -bottom-6 w-44 h-44 opacity-30" />
            <p className="text-xs font-semibold tracking-wider text-[#D4AF6A] uppercase">
              {instituteName}
            </p>
            <h1 className="font-display text-3xl font-semibold mt-2 leading-tight [text-wrap:balance]">
              {workshopName}
            </h1>
            <p className="mt-3 text-sm text-[#D6D0C4] leading-relaxed">
              Explore the classical mathematics, sacred proportions, and traditional construction
              principles of Yantra Shastra with guided instruction from senior faculty.
            </p>
          </div>

          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#1E1C1A]">
              Masterclass Highlights
            </h2>
            <ul className="space-y-2.5 text-sm text-[#4A443D]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#9A7230] shrink-0 mt-0.5" />
                <span>Foundational principles of Sri Yantra &amp; geometric symmetry</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#9A7230] shrink-0 mt-0.5" />
                <span>Guided live Q&amp;A, curriculum workbook, and batch scheduling options</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#9A7230] shrink-0 mt-0.5" />
                <span>Dedicated faculty counsellor call &amp; WhatsApp registration support</span>
              </li>
            </ul>
          </div>

          {/* Attribution Inspector for Google Ads Testing */}
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#9A7230]" />
                <span>Google Ads Attribution Parameters</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setUtmSource('google');
                  setUtmMedium('cpc');
                  setUtmCampaign('Yantra Masterclass – Search India');
                  setGclid(`EAIaIQobChMI_${Math.random().toString(36).slice(2, 9)}`);
                }}
                className="text-[11px] font-semibold text-[#9A7230] hover:underline"
              >
                Generate Sample GCLID
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] text-[#6B645B] mb-1">utm_campaign</label>
                <input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#D6D0C4] rounded-lg bg-[#FBF9F5]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6B645B] mb-1">gclid</label>
                <input
                  type="text"
                  value={gclid}
                  onChange={(e) => setGclid(e.target.value)}
                  placeholder="Auto-captured from Ad URL"
                  className="w-full px-2.5 py-1.5 font-mono border border-[#D6D0C4] rounded-lg bg-[#FBF9F5]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lead Capture Form */}
        <div className="lg:col-span-6 bg-white border border-[#E7E2D8] rounded-xl p-6 sm:p-8 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-[#1E1C1A]">
            Request Workshop Brochure &amp; Seat Availability
          </h2>
          <p className="text-xs text-[#6B645B] mt-1">
            Submit your details below. Our admissions desk will connect with you on phone or WhatsApp.
          </p>

          {resultMsg && (
            <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Mobile / WhatsApp Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                City / Location *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Pune, Mumbai, Bengaluru"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Questions or Preferred Batch Timing (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Weekend morning / evening preference..."
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg focus:outline-none focus:border-[#B08942]"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#4A443D] cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                required
                className="mt-0.5 rounded border-[#D6D0C4]"
              />
              <span>
                I consent to <strong>{instituteName}</strong> contacting me via Phone and WhatsApp regarding the {workshopName}.{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacy((p) => !p)}
                  className="text-[#9A7230] font-semibold hover:underline"
                >
                  Privacy Policy
                </button>
              </span>
            </label>

            {showPrivacy && (
              <div className="p-3 rounded-lg bg-[#FBF9F5] border border-[#E7E2D8] text-[11px] text-[#57514A] leading-relaxed">
                {privacyPolicyText}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting Enquiry...' : 'Submit Workshop Enquiry'}
            </button>

            <p className="text-[11px] text-[#78716C] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#9A7230]" />
              <span>Your personal details are securely encrypted and never shared.</span>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};
