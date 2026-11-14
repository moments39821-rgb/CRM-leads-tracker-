export type UserRole = 'super_admin' | 'manager' | 'staff' | 'pending';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  displayName?: string;
  role: 'super_admin' | 'manager' | 'staff';
  invitedBy: string;
  createdAt: string;
}

export type LeadSource =
  | 'Google Ads Landing Page'
  | 'Google Ads Lead Form'
  | 'Website Organic'
  | 'Manual Entry'
  | 'File Import'
  | 'Google Sheets Import'
  | 'Other';

export type ContactStatus =
  | 'New Lead'
  | 'Call Received'
  | 'Call Connected'
  | 'Call Not Received'
  | 'Call Denied'
  | 'Called Back'
  | 'Follow-up Required'
  | 'Interested'
  | 'Not Interested'
  | 'Registration Confirmed';

export type RegistrationStatus = 'Pending' | 'Registered' | 'Cancelled';
export type LeadPriority = 'Hot' | 'Warm' | 'Cold';

export interface Lead {
  id: string;
  serialNumber: number;
  applicantName: string;
  phoneNumber: string;
  normalizedPhone: string;
  location: string;
  leadSource: LeadSource;
  campaignId?: string;
  campaignName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gclid?: string;
  contactStatus: ContactStatus;
  registrationStatus: RegistrationStatus;
  priority: LeadPriority;
  callDurationSeconds: number;
  lastCallAt?: string;
  followUpDate?: string;
  followUpTime?: string;
  followUpNotes?: string;
  followUpCompleted?: boolean;
  importedFrom?: string;
  notes?: string;
  consentGiven?: boolean;
  consentTimestamp?: string;
  isDemo?: boolean;
  assignedTo?: string;
  sheetRowNumber?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'lead_received'
  | 'call_attempted'
  | 'call_connected'
  | 'call_duration_logged'
  | 'whatsapp_initiated'
  | 'followup_scheduled'
  | 'followup_completed'
  | 'status_changed'
  | 'registration_confirmed'
  | 'note_added'
  | 'file_imported'
  | 'lead_updated';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  title: string;
  description?: string;
  performedBy?: string;
  performedByUid?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  source: string;
  utmCampaign?: string;
  status: 'Active' | 'Paused' | 'Completed';
  budget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopSettings {
  instituteName: string;
  workshopName: string;
  logoDataUrl?: string;
  defaultCountryCode: string;
  googleAdsWebhookKey?: string;
  googleSheetId?: string;
  googleSheetTitle?: string;
  googleSheetTabName?: string;
  autoSyncSheets?: boolean;
  exportDefaultFormat?: 'csv' | 'xlsx';
  privacyPolicyText?: string;
  updatedAt: string;
}

export const CONTACT_STATUSES: ContactStatus[] = [
  'New Lead',
  'Call Received',
  'Call Connected',
  'Call Not Received',
  'Call Denied',
  'Called Back',
  'Follow-up Required',
  'Interested',
  'Not Interested',
  'Registration Confirmed',
];

export const LEAD_SOURCES: LeadSource[] = [
  'Google Ads Landing Page',
  'Google Ads Lead Form',
  'Website Organic',
  'Manual Entry',
  'File Import',
  'Google Sheets Import',
  'Other',
];

export const DEFAULT_WHATSAPP_MESSAGE = `Namaste! Thank you for showing interest in the Yantra Shastra Masterclass conducted by SHRI V.M. JOSHI INSTITUTE.

We received your enquiry regarding our workshop.

We would love to share more information about the workshop, its benefits, and registration details.

Please let us know a convenient time to connect with you.

Thank you!`;

export const QUICK_NOTE_PRESETS = [
  'Interested in workshop.',
  'Asked to call tomorrow.',
  'Will confirm after discussing with family.',
  'Requested workshop fee details.',
];
