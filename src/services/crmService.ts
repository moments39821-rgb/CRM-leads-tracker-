import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  limit,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  DEFAULT_WHATSAPP_MESSAGE,
  type Lead,
  type LeadActivity,
  type Campaign,
  type MessageTemplate,
  type WorkshopSettings,
  type UserProfile,
  type TeamInvite,
  type ContactStatus,
  type ActivityType,
  type LeadSource,
  type LeadPriority,
  type RegistrationStatus,
} from '../types/crm';
import { normalizePhoneNumber, formatDurationSeconds } from '../utils/phone';

export function subscribeLeads(
  onData: (leads: Lead[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: Lead[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Lead, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'leads');
      } catch (e) {
        if (onError) onError(e as Error);
      }
    }
  );
}

export function subscribeActivities(
  onData: (activities: LeadActivity[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'lead_activities'), orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snap) => {
      const items: LeadActivity[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LeadActivity, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'lead_activities');
      } catch (e) {
        if (onError) onError(e as Error);
      }
    }
  );
}

export function subscribeCampaigns(onData: (campaigns: Campaign[]) => void) {
  const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Campaign, 'id'>),
        }))
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'campaigns')
  );
}

export function subscribeTemplates(onData: (templates: MessageTemplate[]) => void) {
  const q = query(collection(db, 'message_templates'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MessageTemplate, 'id'>),
        }))
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'message_templates')
  );
}

export function subscribeWorkshopSettings(onData: (settings: WorkshopSettings | null) => void) {
  return onSnapshot(
    doc(db, 'settings', 'workshop'),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as WorkshopSettings);
      } else {
        onData(null);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'settings/workshop')
  );
}

export function subscribeUsers(onData: (users: UserProfile[]) => void) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as UserProfile));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
}

export function subscribeTeamInvites(onData: (invites: TeamInvite[]) => void) {
  const q = query(collection(db, 'team_invites'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TeamInvite, 'id'>),
        }))
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'team_invites')
  );
}

export async function logLeadActivity(params: {
  leadId: string;
  type: ActivityType;
  title: string;
  description?: string;
  performedBy?: string;
  performedByUid?: string;
}) {
  const now = new Date().toISOString();
  try {
    await addDoc(collection(db, 'lead_activities'), {
      leadId: params.leadId,
      type: params.type,
      title: params.title.slice(0, 200),
      description: (params.description || '').slice(0, 1000),
      performedBy: (params.performedBy || 'CRM Admin').slice(0, 160),
      performedByUid: (params.performedByUid || '').slice(0, 128),
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'lead_activities');
  }
}

export interface CreateLeadInput {
  applicantName: string;
  phoneNumber: string;
  location?: string;
  leadSource: LeadSource;
  campaignName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gclid?: string;
  contactStatus?: ContactStatus;
  registrationStatus?: RegistrationStatus;
  priority?: LeadPriority;
  callDurationSeconds?: number;
  followUpDate?: string;
  followUpTime?: string;
  followUpNotes?: string;
  importedFrom?: string;
  notes?: string;
  isDemo?: boolean;
  createdByUid?: string;
  createdByName?: string;
  defaultCountryCode?: string;
  existingLeads?: Lead[];
  nextSerialNumber: number;
}

export async function createLeadRecord(input: CreateLeadInput): Promise<{
  status: 'created' | 'duplicate';
  leadId: string;
}> {
  const { e164 } = normalizePhoneNumber(input.phoneNumber, input.defaultCountryCode || '+91');
  const now = new Date().toISOString();

  // Duplicate check against existing leads in same mode (real vs demo)
  const isDemo = Boolean(input.isDemo);
  const existingMatch = (input.existingLeads || []).find(
    (l) => l.normalizedPhone === e164 && Boolean(l.isDemo) === isDemo
  );

  if (existingMatch) {
    await logLeadActivity({
      leadId: existingMatch.id,
      type: 'lead_received',
      title: `Duplicate lead entry skipped (${input.leadSource})`,
      description: input.importedFrom
        ? `Matched existing phone ${e164} during import from "${input.importedFrom}". Original record preserved.`
        : `Matched existing phone ${e164}. Original record preserved.`,
      performedBy: input.createdByName || 'CRM Staff',
      performedByUid: input.createdByUid || '',
    });
    return { status: 'duplicate', leadId: existingMatch.id };
  }

  const contactStatus: ContactStatus = input.contactStatus || 'New Lead';
  const registrationStatus: RegistrationStatus =
    contactStatus === 'Registration Confirmed'
      ? 'Registered'
      : input.registrationStatus || 'Pending';

  const payload = {
    serialNumber: input.nextSerialNumber,
    applicantName: input.applicantName.trim().slice(0, 160),
    phoneNumber: e164 || input.phoneNumber.trim().slice(0, 32),
    normalizedPhone: e164 || input.phoneNumber.replace(/\D/g, '').slice(0, 24),
    location: (input.location || '').trim().slice(0, 160),
    leadSource: input.leadSource,
    campaignId: '',
    campaignName: (input.campaignName || '').trim().slice(0, 160),
    utmSource: (input.utmSource || '').trim().slice(0, 120),
    utmMedium: (input.utmMedium || '').trim().slice(0, 120),
    utmCampaign: (input.utmCampaign || '').trim().slice(0, 160),
    gclid: (input.gclid || '').trim().slice(0, 200),
    contactStatus,
    registrationStatus,
    priority: input.priority || 'Warm',
    callDurationSeconds: Math.max(0, Math.min(86400, Number(input.callDurationSeconds) || 0)),
    followUpDate: (input.followUpDate || '').trim().slice(0, 20),
    followUpTime: (input.followUpTime || '').trim().slice(0, 16),
    followUpNotes: (input.followUpNotes || '').trim().slice(0, 1000),
    followUpCompleted: false,
    importedFrom: (input.importedFrom || '').trim().slice(0, 240),
    notes: (input.notes || '').trim().slice(0, 4000),
    consentGiven: true,
    consentTimestamp: now,
    isDemo,
    assignedTo: input.createdByUid || '',
    createdBy: input.createdByUid || '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const ref = await addDoc(collection(db, 'leads'), payload);
    await logLeadActivity({
      leadId: ref.id,
      type: input.importedFrom ? 'file_imported' : 'lead_received',
      title: input.importedFrom
        ? `Imported from ${input.importedFrom}`
        : `Lead added via ${input.leadSource}`,
      description: input.campaignName ? `Campaign: ${input.campaignName}` : undefined,
      performedBy: input.createdByName || 'CRM Staff',
      performedByUid: input.createdByUid || '',
    });
    return { status: 'created', leadId: ref.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'leads');
  }
}

export async function updateLeadFields(
  leadId: string,
  updates: Partial<Omit<Lead, 'id' | 'createdAt'>>,
  activity?: {
    type: ActivityType;
    title: string;
    description?: string;
    performedBy?: string;
    performedByUid?: string;
  }
) {
  const now = new Date().toISOString();
  try {
    const cleanUpdates: Record<string, unknown> = {
      ...updates,
      updatedAt: now,
    };

    if (updates.contactStatus === 'Registration Confirmed') {
      cleanUpdates.registrationStatus = 'Registered';
    } else if (updates.contactStatus === 'Not Interested') {
      cleanUpdates.registrationStatus = 'Cancelled';
    }

    await updateDoc(doc(db, 'leads', leadId), cleanUpdates);

    if (activity) {
      await logLeadActivity({
        leadId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        performedBy: activity.performedBy,
        performedByUid: activity.performedByUid,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
  }
}

export async function updateCallDuration(
  leadId: string,
  seconds: number,
  performedBy?: string,
  performedByUid?: string,
  newStatus?: ContactStatus
) {
  const safeSeconds = Math.max(0, Math.min(86400, Math.round(seconds)));
  const now = new Date().toISOString();
  const updates: Partial<Lead> = {
    callDurationSeconds: safeSeconds,
    lastCallAt: now,
  };
  if (newStatus) {
    updates.contactStatus = newStatus;
  }
  await updateLeadFields(leadId, updates, {
    type: 'call_duration_logged',
    title: `Call duration logged: ${formatDurationSeconds(safeSeconds)}`,
    description: newStatus ? `Status updated to ${newStatus}` : undefined,
    performedBy,
    performedByUid,
  });
}

export async function bulkUpdateLeadStatus(
  leadIds: string[],
  contactStatus: ContactStatus,
  performedBy?: string,
  performedByUid?: string
) {
  const now = new Date().toISOString();
  const registrationStatus: RegistrationStatus =
    contactStatus === 'Registration Confirmed'
      ? 'Registered'
      : contactStatus === 'Not Interested'
      ? 'Cancelled'
      : 'Pending';

  try {
    const batch = writeBatch(db);
    for (const id of leadIds) {
      batch.update(doc(db, 'leads', id), {
        contactStatus,
        registrationStatus,
        updatedAt: now,
      });
    }
    await batch.commit();

    // Log activities sequentially/concurrently
    await Promise.all(
      leadIds.map((id) =>
        logLeadActivity({
          leadId: id,
          type: contactStatus === 'Registration Confirmed' ? 'registration_confirmed' : 'status_changed',
          title: `Bulk status updated to ${contactStatus}`,
          performedBy,
          performedByUid,
        })
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'leads/bulk');
  }
}

export async function deleteLeadRecord(leadId: string) {
  try {
    await deleteDoc(doc(db, 'leads', leadId));
    const actSnap = await getDocs(query(collection(db, 'lead_activities'), where('leadId', '==', leadId)));
    if (!actSnap.empty) {
      const batch = writeBatch(db);
      actSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leads/${leadId}`);
  }
}

export async function bulkDeleteLeadRecords(leadIds: string[]) {
  try {
    const batch = writeBatch(db);
    for (const id of leadIds) {
      batch.delete(doc(db, 'leads', id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'leads/bulk');
  }
}

export async function saveWorkshopSettings(settings: Partial<WorkshopSettings>) {
  const now = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'settings', 'workshop'),
      {
        ...settings,
        updatedAt: now,
      },
      { merge: true }
    );
    // Keep non-sensitive public branding in sync for Login & Public Landing Page
    const publicFields: Record<string, string> = { updatedAt: now };
    if (settings.instituteName !== undefined) publicFields.instituteName = settings.instituteName;
    if (settings.workshopName !== undefined) publicFields.workshopName = settings.workshopName;
    if (settings.logoDataUrl !== undefined) publicFields.logoDataUrl = settings.logoDataUrl;
    if (settings.defaultCountryCode !== undefined)
      publicFields.defaultCountryCode = settings.defaultCountryCode;
    if (settings.privacyPolicyText !== undefined)
      publicFields.privacyPolicyText = settings.privacyPolicyText;

    if (Object.keys(publicFields).length > 1) {
      await setDoc(doc(db, 'public_branding', 'workshop'), publicFields, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/workshop');
  }
}

export async function syncUserProfileClient(firebaseUser: User): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').toLowerCase();
  const displayName = firebaseUser.displayName || email.split('@')[0] || 'Institute User';
  const photoURL = firebaseUser.photoURL || '';
  const now = new Date().toISOString();

  const userRef = doc(db, 'users', uid);
  const existingSnap = await getDoc(userRef);

  let role: UserProfile['role'] = 'pending';
  let isActive = false;

  if (email === 'moments39821@gmail.com') {
    role = 'super_admin';
    isActive = true;
  } else if (existingSnap.exists()) {
    const data = existingSnap.data();
    role = (data.role as UserProfile['role']) || 'pending';
    isActive = Boolean(data.isActive);
  } else if (email) {
    try {
      const inviteSnap = await getDoc(doc(db, 'team_invites', email));
      if (inviteSnap.exists()) {
        role = (inviteSnap.data().role as UserProfile['role']) || 'staff';
        isActive = true;
      }
    } catch {
      // No invite found
    }
  }

  const profile: UserProfile = {
    uid,
    email,
    displayName: existingSnap.exists()
      ? (existingSnap.data().displayName as string) || displayName
      : displayName,
    photoURL,
    role,
    isActive,
    createdAt: existingSnap.exists()
      ? (existingSnap.data().createdAt as string) || now
      : now,
    updatedAt: now,
  };

  try {
    await setDoc(userRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  return profile;
}

export async function ensureDefaultsClient(isSuperAdmin: boolean) {
  if (!isSuperAdmin) return;
  const now = new Date().toISOString();
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'workshop'));
    if (!settingsSnap.exists()) {
      const generatedKey = `vmj_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      const defaultPrivacy =
        'Shri V.M. Joshi Institute collects applicant name, phone number, city/location, and campaign attribution solely to provide information and registration support for the Yantra Shastra Masterclass. Your contact details are never sold or shared with unrelated third parties.';
      await setDoc(doc(db, 'settings', 'workshop'), {
        instituteName: 'SHRI V.M. JOSHI INSTITUTE',
        workshopName: 'Yantra Shastra Masterclass',
        logoDataUrl: '',
        defaultCountryCode: '+91',
        googleAdsWebhookKey: generatedKey,
        googleSheetId: '',
        googleSheetTitle: '',
        googleSheetTabName: 'Leads',
        autoSyncSheets: false,
        exportDefaultFormat: 'xlsx',
        privacyPolicyText: defaultPrivacy,
        updatedAt: now,
      });
      await setDoc(doc(db, 'public_branding', 'workshop'), {
        instituteName: 'SHRI V.M. JOSHI INSTITUTE',
        workshopName: 'Yantra Shastra Masterclass',
        logoDataUrl: '',
        defaultCountryCode: '+91',
        privacyPolicyText: defaultPrivacy,
        updatedAt: now,
      });
    }

    const tplSnap = await getDocs(query(collection(db, 'message_templates'), limit(1)));
    if (tplSnap.empty) {
      await addDoc(collection(db, 'message_templates'), {
        name: 'Yantra Masterclass Welcome',
        body: DEFAULT_WHATSAPP_MESSAGE,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('Default seeding skipped:', err);
  }
}

export function subscribeAndPromotePublicEnquiries(
  getExistingLeads: () => Lead[],
  getNextSerial: () => number,
  defaultCountryCode: string,
  staffUid: string,
  staffName: string,
  onPromoted?: (count: number) => void
) {
  let processing = false;
  return onSnapshot(collection(db, 'public_enquiries'), async (snap) => {
    if (snap.empty || processing) return;
    processing = true;
    let promoted = 0;
    let serial = getNextSerial();
    const runningLeads = [...getExistingLeads()];

    try {
      for (const enqDoc of snap.docs) {
        const d = enqDoc.data();
        const res = await createLeadRecord({
          applicantName: String(d.applicantName || 'Workshop Applicant'),
          phoneNumber: String(d.phoneNumber || ''),
          location: String(d.location || ''),
          leadSource: (d.leadSource as LeadSource) || 'Google Ads Landing Page',
          campaignName: String(d.campaignName || ''),
          utmSource: String(d.utmSource || ''),
          utmMedium: String(d.utmMedium || ''),
          utmCampaign: String(d.utmCampaign || ''),
          gclid: String(d.gclid || ''),
          priority: d.gclid ? 'Hot' : 'Warm',
          notes: String(d.notes || ''),
          isDemo: false,
          createdByUid: staffUid,
          createdByName: staffName,
          defaultCountryCode,
          existingLeads: runningLeads,
          nextSerialNumber: serial,
        });
        if (res.status === 'created') {
          serial++;
          promoted++;
          runningLeads.push({
            id: res.leadId,
            serialNumber: serial - 1,
            applicantName: String(d.applicantName || ''),
            phoneNumber: String(d.phoneNumber || ''),
            normalizedPhone: String(d.normalizedPhone || d.phoneNumber || ''),
            location: String(d.location || ''),
            leadSource: (d.leadSource as LeadSource) || 'Google Ads Landing Page',
            contactStatus: 'New Lead',
            registrationStatus: 'Pending',
            priority: d.gclid ? 'Hot' : 'Warm',
            callDurationSeconds: 0,
            isDemo: false,
            createdAt: String(d.createdAt || new Date().toISOString()),
            updatedAt: String(d.createdAt || new Date().toISOString()),
          });
        }
        await deleteDoc(enqDoc.ref);
      }
      if (promoted > 0 && onPromoted) {
        onPromoted(promoted);
      }
    } catch (err) {
      console.error('Error promoting public enquiries:', err);
    } finally {
      processing = false;
    }
  });
}

export async function createCampaignRecord(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  try {
    await addDoc(collection(db, 'campaigns'), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'campaigns');
  }
}

export async function updateCampaignRecord(id: string, data: Partial<Campaign>) {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'campaigns', id), { ...data, updatedAt: now });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${id}`);
  }
}

export async function saveTemplateRecord(template: Partial<MessageTemplate> & { id?: string; name: string; body: string; isDefault: boolean }) {
  const now = new Date().toISOString();
  try {
    if (template.isDefault) {
      const snap = await getDocs(collection(db, 'message_templates'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        if (d.id !== template.id && d.data().isDefault) {
          batch.update(d.ref, { isDefault: false, updatedAt: now });
        }
      });
      await batch.commit();
    }

    if (template.id) {
      await updateDoc(doc(db, 'message_templates', template.id), {
        name: template.name,
        body: template.body,
        isDefault: template.isDefault,
        updatedAt: now,
      });
    } else {
      await addDoc(collection(db, 'message_templates'), {
        name: template.name,
        body: template.body,
        isDefault: template.isDefault,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'message_templates');
  }
}

export async function deleteTemplateRecord(id: string) {
  try {
    await deleteDoc(doc(db, 'message_templates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `message_templates/${id}`);
  }
}

export async function createTeamInvite(email: string, role: 'super_admin' | 'manager' | 'staff', displayName: string, invitedByUid: string) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  try {
    await setDoc(doc(db, 'team_invites', normalizedEmail), {
      email: normalizedEmail,
      displayName: displayName.trim().slice(0, 120),
      role,
      invitedBy: invitedByUid,
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `team_invites/${normalizedEmail}`);
  }
}

export async function deleteTeamInvite(id: string) {
  try {
    await deleteDoc(doc(db, 'team_invites', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `team_invites/${id}`);
  }
}

export async function updateUserProfileRole(uid: string, role: UserProfile['role'], isActive: boolean) {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      isActive,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}
