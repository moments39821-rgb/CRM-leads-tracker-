import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, Lock } from 'lucide-react';
import { BrandMark, SriYantraHairline } from './BrandMark';
import editorialYantraImg from '../assets/images/yantra_sacred_geometry_1794643703388.jpg';

interface LoginViewProps {
  instituteName: string;
  workshopName: string;
  logoDataUrl?: string;
  onGoogleSignIn: () => Promise<void>;
  onOpenLandingPreview: () => void;
  authError?: string | null;
  pendingMessage?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  instituteName,
  workshopName,
  logoDataUrl,
  onGoogleSignIn,
  onOpenLandingPreview,
  authError,
  pendingMessage,
}) => {
  const [signingIn, setSigningIn] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await onGoogleSignIn();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col lg:flex-row">
      {/* Left Editorial Panel */}
      <div className="relative lg:w-1/2 min-h-[300px] lg:min-h-screen bg-[#1E1C1A] overflow-hidden flex flex-col justify-between p-8 lg:p-14">
        {!imgError ? (
          <img
            src={editorialYantraImg}
            alt="Engraved brass Sri Yantra plate on warm travertine stone"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E1C1A] via-[#1E1C1A]/65 to-[#1E1C1A]/40" />

        <div className="relative z-10 flex items-center gap-3.5">
          <BrandMark logoDataUrl={logoDataUrl} size="md" />
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#D4AF6A] uppercase">
              {instituteName}
            </p>
            <p className="text-sm text-[#EAE5DA] font-medium">{workshopName}</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg mt-12 lg:mt-0">
          <h1 className="font-display text-3xl lg:text-4xl font-semibold text-white leading-tight tracking-tight [text-wrap:balance]">
            Sacred Geometry Masterclass Lead &amp; Registration Desk
          </h1>
          <p className="mt-4 text-sm lg:text-base text-[#D6D0C4] leading-relaxed">
            Organize Google Ads workshop enquiries, track phone consultations and call durations,
            coordinate WhatsApp follow-ups, and synchronize applicant registers with Google Sheets.
          </p>
        </div>

        <div className="relative z-10 hidden lg:flex items-center gap-6 text-xs text-[#A8A095] pt-6 border-t border-white/10">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#D4AF6A]" />
            Role-based access control
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#D4AF6A]" />
            Verified Google OAuth &amp; Google Sheets sync
          </span>
        </div>
      </div>

      {/* Right Sign-In Panel */}
      <div className="relative flex-1 flex items-center justify-center p-6 sm:p-12 yantra-subtle-grid">
        <SriYantraHairline className="absolute right-8 bottom-8 w-56 h-56 opacity-40 hidden sm:block" />

        <div className="relative z-10 w-full max-w-md bg-white border border-[#E7E2D8] rounded-xl p-8 sm:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <BrandMark logoDataUrl={logoDataUrl} size="md" />
            <div>
              <h2 className="font-display text-xl font-semibold text-[#1E1C1A]">
                Administrator Sign In
              </h2>
              <p className="text-xs text-[#6B645B]">
                {instituteName} · Smart Lead CRM
              </p>
            </div>
          </div>

          <p className="text-sm text-[#57514A] leading-relaxed mb-6">
            Sign in with your authorized Google account to access workshop leads, analytics,
            follow-up schedules, and Google Sheets integration.
          </p>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {authError}
            </div>
          )}

          {pendingMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              {pendingMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={signingIn}
            className="gsi-material-button w-full"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5 shrink-0"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <div className="mt-6 pt-5 border-t border-[#E7E2D8] flex flex-col gap-3">
            <button
              type="button"
              onClick={onOpenLandingPreview}
              className="w-full py-2.5 px-4 rounded-lg border border-[#E7E2D8] bg-[#F8F7F4] hover:bg-[#F1EDE4] text-xs font-semibold text-[#1E1C1A] flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#9A7230]" />
              <span>Open Public Workshop Lead Capture Page</span>
            </button>
            <p className="text-[11px] text-[#78716C] text-center leading-relaxed">
              Protected by Firebase Authentication. Only authorized institute staff can view applicant records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
