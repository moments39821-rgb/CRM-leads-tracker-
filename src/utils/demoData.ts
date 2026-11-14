import { collection, getDocs, query, where, writeBatch, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { ContactStatus, LeadPriority, LeadSource, RegistrationStatus } from '../types/crm';

interface DemoLeadSeed {
  applicantName: string;
  phoneNumber: string;
  location: string;
  leadSource: LeadSource;
  campaignName: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  gclid: string;
  contactStatus: ContactStatus;
  registrationStatus: RegistrationStatus;
  priority: LeadPriority;
  callDurationSeconds: number;
  followUpOffsetDays?: number;
  followUpTime?: string;
  followUpNotes?: string;
  importedFrom?: string;
  notes: string;
  daysAgo: number;
}

const DEMO_SEEDS: DemoLeadSeed[] = [
  {
    applicantName: 'Aarav Deshmukh',
    phoneNumber: '+919820411290',
    location: 'Pune, Maharashtra',
    leadSource: 'Google Ads Landing Page',
    campaignName: 'Yantra Masterclass – Search India',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'yantra_masterclass_search',
    gclid: 'EAIaIQobChMI9_demo_01',
    contactStatus: 'Registration Confirmed',
    registrationStatus: 'Registered',
    priority: 'Hot',
    callDurationSeconds: 412,
    notes: 'Confirmed seat for Sunday Yantra Shastra batch. Fee receipt sent.',
    daysAgo: 0,
  },
  {
    applicantName: 'Meenakshi Iyer',
    phoneNumber: '+919840722156',
    location: 'Bengaluru, Karnataka',
    leadSource: 'Google Ads Lead Form',
    campaignName: 'Sacred Geometry & Vastu – Display',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'sacred_geometry_display',
    gclid: 'EAIaIQobChMI9_demo_02',
    contactStatus: 'Interested',
    registrationStatus: 'Pending',
    priority: 'Hot',
    callDurationSeconds: 285,
    followUpOffsetDays: 0,
    followUpTime: '17:30',
    followUpNotes: 'Will confirm after discussing with family.',
    notes: 'Requested workshop syllabus PDF and weekend schedule.',
    daysAgo: 1,
  },
  {
    applicantName: 'Rajendra Kulkarni',
    phoneNumber: '+919422088341',
    location: 'Nashik, Maharashtra',
    leadSource: 'Google Ads Landing Page',
    campaignName: 'Yantra Masterclass – Search India',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'yantra_masterclass_search',
    gclid: 'EAIaIQobChMI9_demo_03',
    contactStatus: 'Follow-up Required',
    registrationStatus: 'Pending',
    priority: 'Warm',
    callDurationSeconds: 194,
    followUpOffsetDays: -1,
    followUpTime: '11:00',
    followUpNotes: 'Asked to call tomorrow.',
    notes: 'Overdue callback requested for morning slot.',
    daysAgo: 2,
  },
  {
    applicantName: 'Dr. Kavita Sharma',
    phoneNumber: '+919811509832',
    location: 'New Delhi, Delhi',
    leadSource: 'Google Ads Lead Form',
    campaignName: 'Vedic Architecture Scholars – Search',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'vedic_architecture_search',
    gclid: 'EAIaIQobChMI9_demo_04',
    contactStatus: 'Call Connected',
    registrationStatus: 'Pending',
    priority: 'Hot',
    callDurationSeconds: 530,
    followUpOffsetDays: 1,
    followUpTime: '15:00',
    followUpNotes: 'Requested workshop fee details.',
    notes: 'Architect interested in Sri Yantra proportional ratios module.',
    daysAgo: 3,
  },
  {
    applicantName: 'Siddharth Joshi',
    phoneNumber: '+919765432180',
    location: 'Mumbai, Maharashtra',
    leadSource: 'File Import',
    campaignName: 'Previous Seminar Alumni List',
    utmSource: 'import',
    utmMedium: 'excel',
    utmCampaign: 'alumni_retarget',
    gclid: '',
    contactStatus: 'Called Back',
    registrationStatus: 'Pending',
    priority: 'Warm',
    callDurationSeconds: 148,
    importedFrom: 'october_enquiry_register.xlsx',
    followUpOffsetDays: 2,
    followUpTime: '16:00',
    followUpNotes: 'Interested in workshop.',
    notes: 'Migrated from Excel register; prefers evening sessions.',
    daysAgo: 4,
  },
  {
    applicantName: 'Ananya Chatterjee',
    phoneNumber: '+919830199412',
    location: 'Kolkata, West Bengal',
    leadSource: 'Google Ads Landing Page',
    campaignName: 'Yantra Masterclass – Search India',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'yantra_masterclass_search',
    gclid: 'EAIaIQobChMI9_demo_06',
    contactStatus: 'New Lead',
    registrationStatus: 'Pending',
    priority: 'Hot',
    callDurationSeconds: 0,
    notes: 'Fresh submission from Google Ads search campaign.',
    daysAgo: 0,
  },
  {
    applicantName: 'Vikramaditya Patel',
    phoneNumber: '+919825044719',
    location: 'Ahmedabad, Gujarat',
    leadSource: 'Website Organic',
    campaignName: 'Institute Website Organic',
    utmSource: 'organic',
    utmMedium: 'web',
    utmCampaign: 'website_organic',
    gclid: '',
    contactStatus: 'Call Not Received',
    registrationStatus: 'Pending',
    priority: 'Warm',
    callDurationSeconds: 22,
    followUpOffsetDays: 0,
    followUpTime: '18:30',
    followUpNotes: 'Ring unanswered; retry in evening.',
    notes: 'First attempt unanswered.',
    daysAgo: 5,
  },
  {
    applicantName: 'Nandini Nair',
    phoneNumber: '+919895110234',
    location: 'Kochi, Kerala',
    leadSource: 'Google Ads Lead Form',
    campaignName: 'Sacred Geometry & Vastu – Display',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'sacred_geometry_display',
    gclid: 'EAIaIQobChMI9_demo_08',
    contactStatus: 'Not Interested',
    registrationStatus: 'Cancelled',
    priority: 'Cold',
    callDurationSeconds: 95,
    notes: 'Timing conflicts with travel; asked to notify for next quarter.',
    daysAgo: 6,
  },
  {
    applicantName: 'Pranav Deshpande',
    phoneNumber: '+919922334455',
    location: 'Nagpur, Maharashtra',
    leadSource: 'File Import',
    campaignName: 'Offline Counselling Register',
    utmSource: 'import',
    utmMedium: 'pdf',
    utmCampaign: 'offline_register',
    gclid: '',
    contactStatus: 'Registration Confirmed',
    registrationStatus: 'Registered',
    priority: 'Hot',
    callDurationSeconds: 368,
    importedFrom: 'nagpur_seminar_leads.pdf',
    notes: 'Migrated from PDF sheet; registered with spouse.',
    daysAgo: 2,
  },
  {
    applicantName: 'Rohini Gokhale',
    phoneNumber: '+919850123778',
    location: 'Thane, Maharashtra',
    leadSource: 'Google Sheets Import',
    campaignName: 'Vedic Architecture Scholars – Search',
    utmSource: 'google_sheets',
    utmMedium: 'sync',
    utmCampaign: 'sheets_migration',
    gclid: '',
    contactStatus: 'Call Received',
    registrationStatus: 'Pending',
    priority: 'Warm',
    callDurationSeconds: 125,
    importedFrom: 'Google Sheet: Yantra Ads Sync',
    followUpOffsetDays: 1,
    followUpTime: '12:30',
    followUpNotes: 'Share brochure on WhatsApp before next call.',
    notes: 'Called institute helpline; wants to learn copper Yantra engraving.',
    daysAgo: 1,
  },
  {
    applicantName: 'Devendra Malhotra',
    phoneNumber: '+971504829104',
    location: 'Dubai, UAE (NRI Batch)',
    leadSource: 'Google Ads Landing Page',
    campaignName: 'International Online Batch – Search',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'yantra_nri_online',
    gclid: 'EAIaIQobChMI9_demo_11',
    contactStatus: 'New Lead',
    registrationStatus: 'Pending',
    priority: 'Hot',
    callDurationSeconds: 0,
    followUpOffsetDays: 0,
    followUpTime: '19:00',
    followUpNotes: 'Interested in live online Zoom attendance.',
    notes: 'International enquiry; confirm IST to GST timezone slot.',
    daysAgo: 0,
  },
  {
    applicantName: 'Suhasini Bhosale',
    phoneNumber: '+919823077615',
    location: 'Kolhapur, Maharashtra',
    leadSource: 'Manual Entry',
    campaignName: 'Offline Counselling Register',
    utmSource: 'walkin',
    utmMedium: 'phone',
    utmCampaign: 'helpline_desk',
    gclid: '',
    contactStatus: 'Call Denied',
    registrationStatus: 'Pending',
    priority: 'Cold',
    callDurationSeconds: 18,
    importedFrom: 'yantra_workshop_contacts.docx',
    notes: 'Busy at work during first call; retry after weekend.',
    daysAgo: 7,
  },
];

export const DEMO_CONTACT_COUNT = DEMO_SEEDS.length;

export async function seedDemoWorkspace(uid: string, userName: string): Promise<number> {
  // Prevent duplicate demo seeding
  let existingEmpty = true;
  try {
    const existing = await getDocs(query(collection(db, 'leads'), where('isDemo', '==', true)));
    existingEmpty = existing.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leads');
  }

  if (!existingEmpty) {
    return 0;
  }

  const now = Date.now();
  let count = 0;

  for (let i = 0; i < DEMO_SEEDS.length; i++) {
    const seed = DEMO_SEEDS[i];
    const createdIso = new Date(now - seed.daysAgo * 86400_000 - i * 3600_000).toISOString();
    let followUpDate = '';
    if (seed.followUpOffsetDays !== undefined) {
      followUpDate = new Date(now + seed.followUpOffsetDays * 86400_000).toISOString().slice(0, 10);
    }

    let docId = '';
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        serialNumber: i + 1,
        applicantName: seed.applicantName,
        phoneNumber: seed.phoneNumber,
        normalizedPhone: seed.phoneNumber,
        location: seed.location,
        leadSource: seed.leadSource,
        campaignId: '',
        campaignName: seed.campaignName,
        utmSource: seed.utmSource,
        utmMedium: seed.utmMedium,
        utmCampaign: seed.utmCampaign,
        gclid: seed.gclid,
        contactStatus: seed.contactStatus,
        registrationStatus: seed.registrationStatus,
        priority: seed.priority,
        callDurationSeconds: seed.callDurationSeconds,
        lastCallAt: seed.callDurationSeconds > 0 ? createdIso : '',
        followUpDate,
        followUpTime: seed.followUpTime || '',
        followUpNotes: seed.followUpNotes || '',
        followUpCompleted: false,
        importedFrom: seed.importedFrom || '',
        notes: seed.notes,
        consentGiven: true,
        consentTimestamp: createdIso,
        isDemo: true,
        assignedTo: uid,
        createdBy: uid,
        createdAt: createdIso,
        updatedAt: createdIso,
      });
      docId = docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leads');
    }

    try {
      await addDoc(collection(db, 'lead_activities'), {
        leadId: docId,
        type: seed.importedFrom ? 'file_imported' : 'lead_received',
        title: seed.importedFrom
          ? `Migrated from ${seed.importedFrom}`
          : `Demo enquiry received via ${seed.leadSource}`,
        description: seed.campaignName,
        performedBy: userName,
        performedByUid: uid,
        createdAt: createdIso,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'lead_activities');
    }

    count++;
  }

  return count;
}

export async function clearDemoWorkspace(): Promise<number> {
  let leadIds: string[] = [];
  try {
    const demoSnap = await getDocs(query(collection(db, 'leads'), where('isDemo', '==', true)));
    if (demoSnap.empty) return 0;

    const batch = writeBatch(db);
    leadIds = demoSnap.docs.map((d) => d.id);
    demoSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'leads');
  }

  // Clean activities for deleted demo leads
  for (const leadId of leadIds) {
    try {
      const actSnap = await getDocs(
        query(collection(db, 'lead_activities'), where('leadId', '==', leadId))
      );
      if (!actSnap.empty) {
        const actBatch = writeBatch(db);
        actSnap.docs.forEach((a) => actBatch.delete(a.ref));
        await actBatch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'lead_activities');
    }
  }

  return leadIds.length;
}
