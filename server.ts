import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

const DEFAULT_PRIVACY_POLICY =
  'Shri V.M. Joshi Institute collects applicant name, phone number, city/location, and campaign attribution solely to provide information and registration support for the Yantra Shastra Masterclass. Your contact details are never sold or shared with unrelated third parties. You may request data correction or deletion at any time by contacting the institute administration.';

// Runtime webhook verification key (seeded from env or synced by Super Admin)
let configuredWebhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY || '';

// Lightweight in-memory sliding-window rate limiter for public lead ingestion
const rateLimitStore = new Map<string, number[]>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const timestamps = (rateLimitStore.get(ip) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return res
        .status(429)
        .json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);
    next();
  };
}

interface AuthedRequest extends Request {
  user?: DecodedIdToken;
}

async function requireFirebaseAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
}

function normalizePhoneServer(raw: string, defaultCountryCode = '+91') {
  const cleaned = String(raw || '').trim();
  const hasPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/\D/g, '');
  const countryDigits = String(defaultCountryCode || '+91').replace(/\D/g, '') || '91';

  if (!hasPlus && digits.startsWith('00') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (!hasPlus && digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (!hasPlus && digits.length > 0 && digits.length <= 10) {
    digits = `${countryDigits}${digits}`;
  }
  const e164 = digits ? `+${digits}` : '';
  return { digitsOnly: digits, e164 };
}

function sanitizeStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function toFirestoreFields(obj: Record<string, string | boolean>) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return { fields };
}

async function createPublicEnquiryInFirestore(payload: Record<string, string | boolean>) {
  const docId = `enq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(
    `${FIRESTORE_REST_BASE}/public_enquiries?documentId=${encodeURIComponent(docId)}&key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreFields(payload)),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Firestore REST write failed (${res.status}): ${errBody}`);
  }
  return docId;
}

interface ParsedRowCandidate {
  applicantName: string;
  phoneNumber: string;
  location: string;
  callDurationSeconds: number;
  contactStatus: string;
  campaignName: string;
  notes: string;
  rawLine: string;
}

function parseDurationServer(input: string): number {
  const trimmed = (input || '').trim();
  if (!trimmed) return 0;
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colonMatch) {
    if (colonMatch[3] !== undefined) {
      return Math.min(
        86400,
        Number(colonMatch[1]) * 3600 + Number(colonMatch[2]) * 60 + Number(colonMatch[3])
      );
    }
    return Math.min(86400, Number(colonMatch[1]) * 60 + Number(colonMatch[2]));
  }
  const minMatch = trimmed.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/i);
  const secMatch = trimmed.match(/(\d+)\s*(?:s|sec|secs|second|seconds)/i);
  const hrsMatch = trimmed.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/i);
  if (minMatch || secMatch || hrsMatch) {
    const h = hrsMatch ? Number(hrsMatch[1]) : 0;
    const m = minMatch ? Number(minMatch[1]) : 0;
    const s = secMatch ? Number(secMatch[1]) : 0;
    return Math.min(86400, h * 3600 + m * 60 + s);
  }
  return 0;
}

function extractCandidatesFromTextLines(lines: string[]): {
  headers: string[];
  rows: string[][];
  extractedLeads: ParsedRowCandidate[];
} {
  const cleanLines = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const extractedLeads: ParsedRowCandidate[] = [];
  const rows: string[][] = [];

  const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{5,10}/g;
  const durationRegex =
    /\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d+\s*(?:min|mins|m)\s*(?:\d+\s*(?:sec|secs|s))?\b/i;

  for (const line of cleanLines) {
    if (/^(?:sl\.?\s*no|serial|name|applicant|phone|mobile|location)/i.test(line) && !/\d{8,}/.test(line)) {
      continue;
    }

    let cells = line.split(/\t|\s*\|\s*|\s{3,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 1 && line.includes(',')) {
      cells = line.split(',').map((c) => c.trim()).filter(Boolean);
    }

    const phoneMatches = line.match(phoneRegex) || [];
    const validPhone = phoneMatches.find(
      (m) => m.replace(/\D/g, '').length >= 8 && m.replace(/\D/g, '').length <= 15
    );

    if (validPhone) {
      rows.push(cells.length > 1 ? cells : [line]);
      const durationMatch = line.match(durationRegex);
      const callDurationSeconds = durationMatch ? parseDurationServer(durationMatch[0]) : 0;

      const remainder = line
        .replace(validPhone, ' | ')
        .replace(durationMatch ? durationMatch[0] : '', ' | ')
        .replace(/^\d+[\.\)\s]+/, '');

      const parts = remainder
        .split(/\t|\||,|—|–|-/)
        .map((p) => p.trim())
        .filter((p) => p.length > 1 && !/^\d+$/.test(p));

      const applicantName = (parts[0] || 'Unknown Applicant').slice(0, 120);
      const location = (parts[1] || '').slice(0, 120);
      const notes = parts.slice(2).join(', ').slice(0, 500);

      extractedLeads.push({
        applicantName,
        phoneNumber: validPhone.trim(),
        location,
        callDurationSeconds,
        contactStatus: 'New Lead',
        campaignName: '',
        notes,
        rawLine: line,
      });
    }
  }

  return {
    headers: ['Applicant Name', 'Phone Number', 'Location', 'Call Duration', 'Notes'],
    rows: rows.slice(0, 500),
    extractedLeads: extractedLeads.slice(0, 500),
  };
}

function extractTableRowsFromHtml(html: string): string[][] {
  const tableRows: string[][] = [];
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cellMatches = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    const row = cellMatches.map((cell) =>
      cell
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (row.some(Boolean)) {
      tableRows.push(row);
    }
  }
  return tableRows;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'yantra-workshop-crm' });
  });

  // Public workshop branding (reads public_branding/workshop via Firestore REST with graceful default fallback)
  app.get('/api/public/workshop-info', async (_req: Request, res: Response) => {
    const defaults = {
      instituteName: 'SHRI V.M. JOSHI INSTITUTE',
      workshopName: 'Yantra Shastra Masterclass',
      logoDataUrl: '',
      defaultCountryCode: '+91',
      privacyPolicyText: DEFAULT_PRIVACY_POLICY,
    };

    try {
      const restRes = await fetch(
        `${FIRESTORE_REST_BASE}/public_branding/workshop?key=${encodeURIComponent(firebaseConfig.apiKey)}`
      );
      if (!restRes.ok) {
        return res.json(defaults);
      }
      const doc = await restRes.json();
      const f = doc.fields || {};
      res.json({
        instituteName: f.instituteName?.stringValue || defaults.instituteName,
        workshopName: f.workshopName?.stringValue || defaults.workshopName,
        logoDataUrl: f.logoDataUrl?.stringValue || '',
        defaultCountryCode: f.defaultCountryCode?.stringValue || '+91',
        privacyPolicyText: f.privacyPolicyText?.stringValue || defaults.privacyPolicyText,
      });
    } catch {
      res.json(defaults);
    }
  });

  // Sync webhook key from authenticated Super Admin session
  app.post('/api/admin/sync-webhook-key', requireFirebaseAuth, (req: AuthedRequest, res: Response) => {
    const key = sanitizeStr(req.body?.googleAdsWebhookKey, 128);
    if (key) {
      configuredWebhookKey = key;
    }
    res.json({ ok: true });
  });

  // Public Google Ads Landing Page Lead Ingestion API
  app.post('/api/leads/ingest', rateLimit(30, 60_000), async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const applicantName = sanitizeStr(body.applicantName || body.name, 160);
      const rawPhone = sanitizeStr(body.phoneNumber || body.phone, 32);
      const location = sanitizeStr(body.location || body.city, 160);
      const utmSource = sanitizeStr(body.utmSource || body.utm_source, 120);
      const utmMedium = sanitizeStr(body.utmMedium || body.utm_medium, 120);
      const utmCampaign = sanitizeStr(body.utmCampaign || body.utm_campaign, 160);
      const gclid = sanitizeStr(body.gclid, 200);
      const campaignName = sanitizeStr(
        body.campaignName || utmCampaign || 'Yantra Masterclass – Search Campaign',
        160
      );
      const notes = sanitizeStr(body.notes, 2000);
      const consentGiven = Boolean(body.consentGiven);
      const leadSource =
        gclid || utmSource.toLowerCase().includes('google')
          ? 'Google Ads Landing Page'
          : 'Website Organic';

      if (!applicantName || applicantName.length < 2) {
        return res.status(400).json({ error: 'Please provide your full name.' });
      }
      if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
        return res.status(400).json({ error: 'Please provide a valid mobile number.' });
      }
      if (!consentGiven) {
        return res.status(400).json({ error: 'Consent is required to submit your workshop enquiry.' });
      }

      const { e164 } = normalizePhoneServer(rawPhone, '+91');
      const now = new Date().toISOString();

      const enquiryId = await createPublicEnquiryInFirestore({
        applicantName,
        phoneNumber: e164,
        normalizedPhone: e164,
        location: location || 'Not specified',
        leadSource,
        campaignId: '',
        campaignName,
        utmSource,
        utmMedium,
        utmCampaign,
        gclid,
        notes,
        consentGiven: true,
        createdAt: now,
      });

      res.status(201).json({
        status: 'created',
        enquiryId,
        message: 'Thank you! Your Yantra Shastra Masterclass enquiry has been registered.',
      });
    } catch (err) {
      console.error('Error ingesting lead:', err);
      res.status(500).json({ error: 'Unable to submit enquiry at this time.' });
    }
  });

  // Google Ads Lead Form Webhook Endpoint
  app.post('/api/webhooks/google-ads', rateLimit(60, 60_000), async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const incomingKey = sanitizeStr(payload.google_key || req.headers['x-google-ads-key'], 128);

      if (!incomingKey || (configuredWebhookKey && incomingKey !== configuredWebhookKey)) {
        return res.status(401).json({ error: 'Invalid webhook verification key' });
      }

      const columns: Array<{ column_id?: string; string_value?: string }> = Array.isArray(
        payload.user_column_data
      )
        ? payload.user_column_data
        : [];

      const findCol = (ids: string[]) => {
        const match = columns.find((c) => ids.includes(String(c.column_id || '').toUpperCase()));
        return sanitizeStr(match?.string_value, 160);
      };

      const applicantName =
        findCol(['FULL_NAME', 'FIRST_NAME', 'NAME']) ||
        sanitizeStr(payload.applicantName, 160) ||
        'Google Ads Applicant';
      const rawPhone = findCol(['PHONE_NUMBER', 'PHONE']) || sanitizeStr(payload.phoneNumber, 32);
      const location =
        findCol(['CITY', 'REGION', 'POSTAL_CODE', 'LOCATION']) ||
        sanitizeStr(payload.location, 160) ||
        'Not specified';
      const gclid = sanitizeStr(payload.gclid || payload.gcl_id, 200);
      const campaignId = sanitizeStr(String(payload.campaign_id || ''), 128);
      const campaignName = sanitizeStr(
        payload.campaign_name ||
          (campaignId ? `Google Ads Campaign #${campaignId}` : 'Google Ads Lead Form'),
        160
      );

      if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
        return res.status(400).json({ error: 'Missing valid PHONE_NUMBER in Google Ads payload' });
      }

      const { e164 } = normalizePhoneServer(rawPhone, '+91');
      const now = new Date().toISOString();

      const enquiryId = await createPublicEnquiryInFirestore({
        applicantName,
        phoneNumber: e164,
        normalizedPhone: e164,
        location,
        leadSource: 'Google Ads Lead Form',
        campaignId,
        campaignName,
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: campaignName,
        gclid,
        notes: payload.lead_id
          ? `Google Ads Lead ID: ${sanitizeStr(String(payload.lead_id), 100)}`
          : '',
        consentGiven: true,
        createdAt: now,
      });

      res.status(201).json({ status: 'created', enquiryId });
    } catch (err) {
      console.error('Google Ads webhook error:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Document Parser for PDF & Word (.docx) Lead Migration
  app.post('/api/import/parse-document', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { fileName, base64Data } = req.body || {};
      if (!fileName || !base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ error: 'Missing fileName or base64Data' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const ext = path.extname(String(fileName)).toLowerCase();

      if (ext === '.docx') {
        const htmlRes = await mammoth.convertToHtml({ buffer });
        const tableRows = extractTableRowsFromHtml(htmlRes.value);
        if (tableRows.length >= 2) {
          const headers = tableRows[0];
          const dataRows = tableRows.slice(1);
          return res.json({
            format: 'docx_table',
            headers,
            rows: dataRows,
            extractedLeads: null,
          });
        }
        const textRes = await mammoth.extractRawText({ buffer });
        const lines = textRes.value.split(/\r?\n/);
        const parsed = extractCandidatesFromTextLines(lines);
        return res.json({
          format: 'docx_text',
          ...parsed,
        });
      }

      if (ext === '.pdf') {
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8, useSystemFonts: true });
        const pdfDoc = await loadingTask.promise;
        const allLines: string[] = [];

        for (let pageNum = 1; pageNum <= Math.min(pdfDoc.numPages, 50); pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const content = await page.getTextContent();
          const lineMap = new Map<number, Array<{ x: number; str: string }>>();

          for (const item of content.items) {
            if ('str' in item && item.str.trim()) {
              const y = Math.round((item.transform?.[5] || 0) / 4) * 4;
              const x = item.transform?.[4] || 0;
              const arr = lineMap.get(y) || [];
              arr.push({ x, str: item.str });
              lineMap.set(y, arr);
            }
          }

          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
          for (const y of sortedYs) {
            const items = (lineMap.get(y) || []).sort((a, b) => a.x - b.x);
            const joined = items.map((i) => i.str).join('  ').trim();
            if (joined) allLines.push(joined);
          }
        }

        const parsed = extractCandidatesFromTextLines(allLines);
        return res.json({
          format: 'pdf',
          ...parsed,
        });
      }

      return res.status(400).json({
        error: 'Unsupported document format on server. Use .docx or .pdf (CSV/Excel are parsed directly).',
      });
    } catch (err) {
      console.error('Document parsing failed:', err);
      res.status(500).json({
        error: 'Unable to parse uploaded document. Please verify the file is not password-protected or corrupted.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yantra Workshop CRM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
