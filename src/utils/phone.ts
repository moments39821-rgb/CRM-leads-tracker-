/**
 * Normalizes phone numbers for WhatsApp (digits only with country code),
 * tel: links (+digits), and duplicate detection.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode = '+91'): {
  digitsOnly: string; // e.g. 919876543210 (for wa.me/)
  e164: string;       // e.g. +919876543210 (for tel: and storage)
  display: string;    // clean formatted representation
} {
  const cleaned = (raw || '').trim();
  const hasPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/\D/g, '');

  const countryDigits = (defaultCountryCode || '+91').replace(/\D/g, '') || '91';

  // Strip leading 00 international prefix if present
  if (!hasPlus && digits.startsWith('00') && digits.length > 10) {
    digits = digits.slice(2);
  }

  // Strip leading single 0 on local 11-digit Indian numbers (e.g. 09876543210 -> 9876543210)
  if (!hasPlus && digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Prepend default country code for 10-digit local numbers
  if (!hasPlus && digits.length === 10) {
    digits = `${countryDigits}${digits}`;
  } else if (!hasPlus && digits.length > 0 && digits.length < 10) {
    digits = `${countryDigits}${digits}`;
  }

  const e164 = digits ? `+${digits}` : '';
  let display = e164 || cleaned;

  if (digits.startsWith('91') && digits.length === 12) {
    display = `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  return {
    digitsOnly: digits,
    e164,
    display,
  };
}

export function buildWhatsAppUrl(phone: string, message: string, defaultCountryCode = '+91'): string {
  const { digitsOnly } = normalizePhoneNumber(phone, defaultCountryCode);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digitsOnly}?text=${encoded}`;
}

export function buildTelUrl(phone: string, defaultCountryCode = '+91'): string {
  const { e164 } = normalizePhoneNumber(phone, defaultCountryCode);
  return `tel:${e164}`;
}

export function formatDurationSeconds(totalSeconds: number | undefined | null): string {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (secs === 0) return '00:00';
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const rem = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(rem)}`;
  }
  return `${pad(mins)}:${pad(rem)}`;
}

export function parseDurationToSeconds(input: string): number {
  const trimmed = (input || '').trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) {
    // Pure integer: treat as seconds if >= 60, or minutes? Let's treat plain numbers as seconds if marked 's', or mm:ss
    return Math.min(86400, Math.max(0, parseInt(trimmed, 10)));
  }
  const parts = trimmed.split(':').map((p) => parseInt(p.replace(/\D/g, ''), 10) || 0);
  if (parts.length === 2) {
    return Math.min(86400, parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3) {
    return Math.min(86400, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  // Support "4m 30s" or "5 min"
  const minMatch = trimmed.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/i);
  const secMatch = trimmed.match(/(\d+)\s*(?:s|sec|secs|second|seconds)/i);
  const hrsMatch = trimmed.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/i);
  if (minMatch || secMatch || hrsMatch) {
    const h = hrsMatch ? parseInt(hrsMatch[1], 10) : 0;
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    const s = secMatch ? parseInt(secMatch[1], 10) : 0;
    return Math.min(86400, h * 3600 + m * 60 + s);
  }
  return 0;
}
