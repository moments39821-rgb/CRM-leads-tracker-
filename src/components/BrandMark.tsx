import React, { useState } from 'react';
import emblemImg from '../assets/images/yantra_institute_emblem_1794643702508.jpg';

interface BrandMarkProps {
  logoDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  logoDataUrl,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';

  const src = logoDataUrl || emblemImg;

  if (imgFailed) {
    return (
      <div
        className={`${dims} rounded-lg bg-[#1E1C1A] border border-[#B08942]/50 flex items-center justify-center shrink-0 ${className}`}
        aria-label="Shri V.M. Joshi Institute Yantra Emblem"
      >
        <svg viewBox="0 0 40 40" className="w-6 h-6 text-[#D4AF6A]" fill="none" stroke="currentColor" strokeWidth="1.25">
          <rect x="6" y="6" width="28" height="28" />
          <circle cx="20" cy="20" r="11" />
          <polygon points="20,10 29,25 11,25" />
          <polygon points="20,30 29,15 11,15" />
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Shri V.M. Joshi Institute Emblem"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${dims} rounded-lg object-cover border border-[#B08942]/40 bg-[#1E1C1A] shrink-0 ${className}`}
    />
  );
};

export const SriYantraHairline: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 120 120"
    className={`text-[#B08942]/20 pointer-events-none select-none ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="0.9"
    aria-hidden="true"
  >
    <rect x="14" y="14" width="92" height="92" />
    <circle cx="60" cy="60" r="40" />
    <circle cx="60" cy="60" r="32" />
    <polygon points="60,22 92,78 28,78" />
    <polygon points="60,98 92,42 28,42" />
    <polygon points="60,34 81,70 39,70" />
    <polygon points="60,86 81,50 39,50" />
    <circle cx="60" cy="60" r="2.2" fill="currentColor" />
  </svg>
);
