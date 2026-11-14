import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BellRing,
  Globe,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
  Database,
} from 'lucide-react';
import {
  auth,
  subscribeToAuthState,
  signInWithGoogleWorkspace,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  subscribeLeads,
  subscribeActivities,
  subscribeCampaigns,
  subscribeTemplates,
  subscribeWorkshopSettings,
  subscribeUsers,
  subscribeTeamInvites,
  createLeadRecord,
  updateLeadFields,
  updateCallDuration,
  bulkUpdateLeadStatus,
  deleteLeadRecord,
  bulkDeleteLeadRecords,
  logLeadActivity,
  saveWorkshopSettings,
  saveTemplateRecord,
  deleteTemplateRecord,
  createCampaignRecord,
  updateCampaignRecord,
  createTeamInvite,
  deleteTeamInvite,
  updateUserProfileRole,
  syncUserProfileClient,
  ensureDefaultsClient,
  subscribeAndPromotePublicEnquiries,
} from './services/crmService';
import { seedDemoWorkspace, clearDemoWorkspace, DEMO_CONTACT_COUNT } from './utils/demoData';
import type {
  Campaign,
  ContactStatus,
  Lead,
  LeadActivity,
  LeadPriority,
  MessageTemplate,
  TeamInvite,
  UserProfile,
  UserRole,
  WorkshopSettings,
} from './types/crm';

import { BrandMark } from './components/BrandMark';
import { ToastContainer, type ToastItem } from './components/Toast';
import { LoginView } from './components/LoginView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { LeadsTableView } from './components/LeadsTableView';
import { FollowUpsView } from './components/FollowUpsView';
import { LandingPageView } from './components/LandingPageView';
import { SettingsView } from './components/SettingsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { CallDurationModal } from './components/CallDurationModal';
import { QuickAddLeadModal } from './components/QuickAddLeadModal';
import { FileMigrationModal } from './components/FileMigrationModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';

type NavView = 'dashboard' | 'leads' | 'followups' | 'landing' | 'settings';

export default function App() {
  const isPublicLandingRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/landing' ||
      new URLSearchParams(window.location.search).get('view') === 'landing');

  const [publicLandingMode, setPublicLandingMode] = useState(isPublicLandingRoute);
  const [publicWorkshopInfo, setPublicWorkshopInfo] = useState({
    instituteName: 'SHRI V.M. JOSHI INSTITUTE',
    workshopName: 'Yantra Shastra Masterclass',
    logoDataUrl: '',
    defaultCountryCode: '+91',
    privacyPolicyText:
      'Shri V.M. Joshi Institute collects applicant details solely to provide information and registration support for the Yantra Shastra Masterclass.',
  });

  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Live Firestore Data
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  // Navigation & Workspace State
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [initialStatusFilter, setInitialStatusFilter] = useState<string>('All');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const autoSeedCheckedRef = useRef(false);

  // Modals & Drawers
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [callState, setCallState] = useState<{
    lead: Lead;
    mode: 'call' | 'edit-duration';
  } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [fileMigrationOpen, setFileMigrationOpen] = useState(false);
  const [sheetsSyncLeads, setSheetsSyncLeads] = useState<Lead[] | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notify = (type: ToastItem['type'], message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  // Boot: test Firestore connection & load public branding
  useEffect(() => {
    testFirestoreConnection();
    fetch('/api/public/workshop-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.instituteName) {
          setPublicWorkshopInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  // Auth state observer
  useEffect(() => {
    const unsub = subscribeToAuthState(async (firebaseUser) => {
      setAuthError(null);
      setPendingMessage(null);
      if (!firebaseUser) {
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await syncUserProfileClient(firebaseUser);
        if (!profile.isActive || profile.role === 'pending') {
          setCurrentUser(null);
          setPendingMessage(
            `Signed in as ${profile.email}, which is currently pending administrator approval. Ask the Shri V.M. Joshi Institute Super Admin to authorize your email in Settings → Team & Roles.`
          );
        } else {
          await ensureDefaultsClient(profile.role === 'super_admin');
          setCurrentUser(profile);
        }
      } catch (err: any) {
        setAuthError(err?.message || 'Unable to complete sign-in.');
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  const allLeadsRef = useRef<Lead[]>([]);
  const nextSerialRef = useRef<number>(1);
  const defaultCountryCodeRef = useRef<string>('+91');

  // Sync webhook verification key to server runtime when settings load/change
  useEffect(() => {
    if (!currentUser || !settings?.googleAdsWebhookKey || !auth.currentUser) return;
    auth.currentUser
      .getIdToken()
      .then((idToken) =>
        fetch('/api/admin/sync-webhook-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ googleAdsWebhookKey: settings.googleAdsWebhookKey }),
        })
      )
      .catch(() => {});
  }, [currentUser, settings?.googleAdsWebhookKey]);

  // Firestore real-time subscriptions when authenticated & active
  useEffect(() => {
    if (!currentUser || !currentUser.isActive || currentUser.role === 'pending') {
      setAllLeads([]);
      setActivities([]);
      setCampaigns([]);
      setTemplates([]);
      setLeadsLoaded(false);
      autoSeedCheckedRef.current = false;
      return;
    }

    const unsubs = [
      subscribeLeads(
        (items) => {
          setAllLeads(items);
          setLeadsLoaded(true);
        },
        (err) => {
          console.error(err);
        }
      ),
      subscribeActivities(setActivities),
      subscribeCampaigns(setCampaigns),
      subscribeTemplates(setTemplates),
      subscribeWorkshopSettings(setSettings),
      subscribeAndPromotePublicEnquiries(
        () => allLeadsRef.current,
        () => nextSerialRef.current,
        defaultCountryCodeRef.current,
        currentUser.uid,
        currentUser.displayName,
        (count) => {
          notify(
            'success',
            `${count} new workshop enquiry lead${count > 1 ? 's' : ''} received`
          );
        }
      ),
    ];

    if (currentUser.role === 'super_admin') {
      unsubs.push(subscribeUsers(setUsers));
      unsubs.push(subscribeTeamInvites(setInvites));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser]);

  // Auto-seed trial demo contacts once when an authorized user lands on a completely empty database
  useEffect(() => {
    if (!currentUser || !leadsLoaded || autoSeedCheckedRef.current) return;
    autoSeedCheckedRef.current = true;

    const hasLiveLeads = allLeads.some((l) => !l.isDemo);
    const hasDemoLeads = allLeads.some((l) => Boolean(l.isDemo));
    const dismissed =
      typeof window !== 'undefined' && window.localStorage.getItem('vmj_demo_dismissed') === '1';

    if (!hasLiveLeads && !dismissed) {
      if (!hasDemoLeads) {
        seedDemoWorkspace(currentUser.uid, currentUser.displayName)
          .then((seeded) => {
            setDemoMode(true);
            if (seeded > 0) {
              notify('info', `Loaded ${seeded} trial demo contacts`);
            }
          })
          .catch((err) => {
            console.error('Auto-seed demo contacts failed:', err);
          });
      } else {
        setDemoMode(true);
      }
    }
  }, [currentUser, leadsLoaded, allLeads]);

  const instituteName =
    settings?.instituteName || publicWorkshopInfo.instituteName || 'SHRI V.M. JOSHI INSTITUTE';
  const workshopName =
    settings?.workshopName || publicWorkshopInfo.workshopName || 'Yantra Shastra Masterclass';
  const logoDataUrl = settings?.logoDataUrl || publicWorkshopInfo.logoDataUrl || '';
  const defaultCountryCode =
    settings?.defaultCountryCode || publicWorkshopInfo.defaultCountryCode || '+91';
  const privacyPolicyText =
    settings?.privacyPolicyText || publicWorkshopInfo.privacyPolicyText;

  // Isolate Demo Mode leads from Production leads
  const visibleLeads = useMemo(
    () => allLeads.filter((l) => Boolean(l.isDemo) === demoMode),
    [allLeads, demoMode]
  );

  const demoLeadCount = useMemo(
    () => allLeads.filter((l) => Boolean(l.isDemo)).length,
    [allLeads]
  );

  const selectedLead = useMemo(
    () => allLeads.find((l) => l.id === selectedLeadId) || null,
    [allLeads, selectedLeadId]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const pendingFollowUpCount = useMemo(
    () =>
      visibleLeads.filter(
        (l) => l.followUpDate && !l.followUpCompleted && l.followUpDate <= todayStr
      ).length,
    [visibleLeads, todayStr]
  );

  const nextSerialNumber = useMemo(() => {
    const maxSerial = allLeads.reduce((m, l) => Math.max(m, Number(l.serialNumber) || 0), 0);
    return maxSerial + 1;
  }, [allLeads]);

  allLeadsRef.current = allLeads;
  nextSerialRef.current = nextSerialNumber;
  defaultCountryCodeRef.current = defaultCountryCode;

  const canDelete =
    currentUser?.role === 'super_admin' || currentUser?.role === 'manager';

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setPendingMessage(null);
    try {
      await signInWithGoogleWorkspace(false);
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in was cancelled or failed.');
    }
  };

  const handleToggleDemoMode = async (enable: boolean) => {
    if (!currentUser) return;
    if (enable) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('vmj_demo_dismissed');
      }
      if (demoLeadCount === 0) {
        const seeded = await seedDemoWorkspace(currentUser.uid, currentUser.displayName);
        if (seeded > 0) {
          notify('success', `Loaded ${seeded} trial demo contacts`);
        }
      } else {
        notify('info', `Viewing ${demoLeadCount} trial demo contacts`);
      }
      setDemoMode(true);
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vmj_demo_dismissed', '1');
      }
      setDemoMode(false);
      notify('info', 'Switched to Live Leads Database');
    }
  };

  const handleClearDemoData = async () => {
    const cleared = await clearDemoWorkspace();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('vmj_demo_dismissed', '1');
    }
    setDemoMode(false);
    notify('success', `Removed ${cleared} demo lead(s)`);
  };

  // Show Public Workshop Landing Page if toggled from Login or URL
  if (publicLandingMode && !currentUser) {
    return (
      <>
        <LandingPageView
          instituteName={instituteName}
          workshopName={workshopName}
          logoDataUrl={logoDataUrl}
          privacyPolicyText={privacyPolicyText}
          onBackToCrm={() => setPublicLandingMode(false)}
          backLabel="Admin Sign In"
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center space-y-3">
          <BrandMark logoDataUrl={logoDataUrl} size="lg" className="mx-auto" />
          <p className="text-xs font-semibold text-[#57514A]">
            Loading {instituteName} CRM...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView
          instituteName={instituteName}
          workshopName={workshopName}
          logoDataUrl={logoDataUrl}
          onGoogleSignIn={handleGoogleSignIn}
          onOpenLandingPreview={() => setPublicLandingMode(true)}
          authError={authError}
          pendingMessage={pendingMessage}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  // Admin Landing Page Preview inside Authenticated Shell
  if (activeView === 'landing') {
    return (
      <>
        <LandingPageView
          instituteName={instituteName}
          workshopName={workshopName}
          logoDataUrl={logoDataUrl}
          privacyPolicyText={privacyPolicyText}
          onBackToCrm={() => setActiveView('leads')}
          backLabel="Return to Lead CRM"
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const navItems: Array<{
    id: NavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'Lead Management', icon: Users, badge: visibleLeads.length },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: BellRing,
      badge: pendingFollowUpCount > 0 ? pendingFollowUpCount : undefined,
    },
    { id: 'landing', label: 'Ad Landing Page', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const viewTitleMap: Record<NavView, string> = {
    dashboard: 'Analytics Overview',
    leads: 'Lead Management Table',
    followups: 'Follow-up Reminders',
    landing: 'Workshop Landing Page',
    settings: 'Administration & Integrations',
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#1E1C1A] text-[#EAE5DA] border-r border-[#2E2A26] shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <BrandMark logoDataUrl={logoDataUrl} size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-[#D4AF6A] uppercase truncate">
              {instituteName}
            </p>
            <p className="font-display text-sm font-semibold text-white truncate">
              {workshopName}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id === 'leads') setInitialStatusFilter('All');
                }}
                className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                  active
                    ? 'bg-[#B08942] text-white'
                    : 'text-[#D6D0C4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? 'text-white' : 'text-[#A8A095]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <button
            type="button"
            onClick={() => handleToggleDemoMode(!demoMode)}
            className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
              demoMode
                ? 'bg-[#B08942]/20 border-[#B08942] text-[#F2D593]'
                : 'border-white/15 text-[#D6D0C4] hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              <span>{demoMode ? 'Demo Mode On' : 'Demo Mode'}</span>
            </span>
            <span className="text-[10px] uppercase">{demoMode ? 'Exit' : 'Try'}</span>
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser.displayName}
              </p>
              <p className="text-[11px] text-[#A8A095] capitalize truncate">
                {currentUser.role.replace('_', ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOutUser()}
              title="Sign Out"
              className="p-2 rounded-lg text-[#A8A095] hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-[#1E1C1A] text-[#EAE5DA] h-full flex flex-col z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <BrandMark logoDataUrl={logoDataUrl} size="sm" />
                <span className="font-display text-sm font-semibold text-white truncate">
                  {instituteName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-[#A8A095] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      active
                        ? 'bg-[#B08942] text-white'
                        : 'text-[#D6D0C4] hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-[11px] tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  handleToggleDemoMode(!demoMode);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                  demoMode
                    ? 'bg-[#B08942]/20 border-[#B08942] text-[#F2D593]'
                    : 'border-white/15 text-[#D6D0C4] hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>{demoMode ? 'Demo Mode On' : 'Demo Contacts'}</span>
                </span>
                <span className="text-[10px] uppercase">{demoMode ? 'Exit' : `${DEMO_CONTACT_COUNT}`}</span>
              </button>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#D6D0C4] truncate">
                  {currentUser.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="px-2.5 py-1.5 rounded bg-white/10 text-xs font-semibold text-white"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-[#E7E2D8] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E7E2D8] text-[#1E1C1A]"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-[#1E1C1A] truncate">
                {viewTitleMap[activeView]}
              </h1>
              <p className="text-xs text-[#6B645B] truncate">
                {instituteName} · {workshopName}
                {demoMode ? ' · Demo Workspace Active' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {demoMode ? (
              <button
                type="button"
                onClick={() => handleToggleDemoMode(false)}
                className="hidden sm:inline-flex px-3 py-2 rounded-lg border border-[#B08942] bg-[#FBF9F5] text-xs font-semibold text-[#7D5B22] whitespace-nowrap"
              >
                Exit Demo Mode
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleDemoMode(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D6D0C4] bg-white hover:bg-[#FBF9F5] text-xs font-semibold text-[#57514A] whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5 text-[#9A7230]" />
                <span>Demo Contacts</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF6A]" />
              <span>Quick Add Lead</span>
            </button>
          </div>
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {activeView === 'dashboard' && (
            <DashboardAnalytics
              leads={visibleLeads}
              onNavigateToLeads={(status) => {
                setInitialStatusFilter(status || 'All');
                setActiveView('leads');
              }}
              onNavigateToFollowUps={() => setActiveView('followups')}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onLoadDemoContacts={() => handleToggleDemoMode(true)}
            />
          )}

          {activeView === 'leads' && (
            <LeadsTableView
              key={initialStatusFilter}
              leads={visibleLeads}
              defaultCountryCode={defaultCountryCode}
              initialStatusFilter={initialStatusFilter}
              canDelete={canDelete}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onStatusChange={async (lead, newStatus) => {
                await updateLeadFields(
                  lead.id,
                  { contactStatus: newStatus },
                  {
                    type:
                      newStatus === 'Registration Confirmed'
                        ? 'registration_confirmed'
                        : 'status_changed',
                    title: `Status changed to ${newStatus}`,
                    performedBy: currentUser.displayName,
                    performedByUid: currentUser.uid,
                  }
                );
                notify('success', `${lead.applicantName}: ${newStatus}`);
              }}
              onPriorityChange={async (lead, priority) => {
                await updateLeadFields(
                  lead.id,
                  { priority },
                  {
                    type: 'lead_updated',
                    title: `Priority set to ${priority}`,
                    performedBy: currentUser.displayName,
                    performedByUid: currentUser.uid,
                  }
                );
                notify('info', `${lead.applicantName} marked ${priority}`);
              }}
              onInlineUpdate={async (lead, updates, activityTitle) => {
                await updateLeadFields(lead.id, updates, {
                  type: 'lead_updated',
                  title: activityTitle,
                  performedBy: currentUser.displayName,
                  performedByUid: currentUser.uid,
                });
                notify('success', activityTitle);
              }}
              onOpenWhatsApp={(lead) => setWhatsappLead(lead)}
              onOpenCall={(lead, mode) => setCallState({ lead, mode })}
              onDeleteLead={async (lead) => {
                await deleteLeadRecord(lead.id);
                if (selectedLeadId === lead.id) setSelectedLeadId(null);
                notify('success', `Deleted lead ${lead.applicantName}`);
              }}
              onBulkStatusUpdate={async (ids, status) => {
                await bulkUpdateLeadStatus(
                  ids,
                  status,
                  currentUser.displayName,
                  currentUser.uid
                );
                notify('success', `Updated ${ids.length} lead(s) to ${status}`);
              }}
              onBulkDelete={async (ids) => {
                await bulkDeleteLeadRecords(ids);
                notify('success', `Deleted ${ids.length} lead(s)`);
              }}
              onOpenQuickAdd={() => setQuickAddOpen(true)}
              onOpenFileMigration={() => setFileMigrationOpen(true)}
              onOpenGoogleSheetsSync={(targetLeads) => setSheetsSyncLeads(targetLeads)}
              onLoadDemoContacts={() => handleToggleDemoMode(true)}
              onNotify={notify}
            />
          )}

          {activeView === 'followups' && (
            <FollowUpsView
              leads={visibleLeads}
              defaultCountryCode={defaultCountryCode}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onMarkCompleted={async (lead) => {
                await updateLeadFields(
                  lead.id,
                  { followUpCompleted: true },
                  {
                    type: 'followup_completed',
                    title: 'Follow-up marked completed',
                    performedBy: currentUser.displayName,
                    performedByUid: currentUser.uid,
                  }
                );
                notify('success', `Follow-up completed for ${lead.applicantName}`);
              }}
              onScheduleFollowUp={async (lead, date, time, notes) => {
                await updateLeadFields(
                  lead.id,
                  {
                    followUpDate: date,
                    followUpTime: time,
                    followUpNotes: notes,
                    followUpCompleted: false,
                  },
                  {
                    type: 'followup_scheduled',
                    title: `Follow-up rescheduled for ${date} ${time}`,
                    description: notes || undefined,
                    performedBy: currentUser.displayName,
                    performedByUid: currentUser.uid,
                  }
                );
                notify('success', `Follow-up scheduled for ${lead.applicantName}`);
              }}
              onOpenWhatsApp={(lead) => setWhatsappLead(lead)}
              onOpenCall={(lead) => setCallState({ lead, mode: 'call' })}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              settings={settings}
              templates={templates}
              campaigns={campaigns}
              users={users}
              invites={invites}
              demoMode={demoMode}
              demoCount={demoLeadCount}
              onSaveSettings={async (updates) => {
                await saveWorkshopSettings(updates);
                notify('success', 'Settings saved');
              }}
              onSaveTemplate={async (tpl) => {
                await saveTemplateRecord(tpl);
                notify('success', `Saved template "${tpl.name}"`);
              }}
              onDeleteTemplate={async (id) => {
                await deleteTemplateRecord(id);
                notify('info', 'Template deleted');
              }}
              onCreateCampaign={async (data) => {
                await createCampaignRecord(data);
                notify('success', `Campaign "${data.name}" added`);
              }}
              onUpdateCampaignStatus={async (id, status) => {
                await updateCampaignRecord(id, { status });
                notify('info', `Campaign marked ${status}`);
              }}
              onInviteUser={async (email, role, displayName) => {
                await createTeamInvite(email, role, displayName, currentUser.uid);
                notify('success', `Authorized ${email} as ${role}`);
              }}
              onDeleteInvite={async (id) => {
                await deleteTeamInvite(id);
                notify('info', 'Invite removed');
              }}
              onUpdateUserRole={async (uid, role, isActive) => {
                await updateUserProfileRole(uid, role, isActive);
                notify('success', 'User role updated');
              }}
              onToggleDemoMode={handleToggleDemoMode}
              onClearDemoData={handleClearDemoData}
              onOpenGoogleSheetsSync={() => setSheetsSyncLeads(visibleLeads)}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <QuickAddLeadModal
        open={quickAddOpen}
        campaignNames={campaigns.map((c) => c.name)}
        onClose={() => setQuickAddOpen(false)}
        onCreate={async (data) => {
          const res = await createLeadRecord({
            ...data,
            isDemo: demoMode,
            createdByUid: currentUser.uid,
            createdByName: currentUser.displayName,
            defaultCountryCode,
            existingLeads: allLeads,
            nextSerialNumber,
          });
          if (res.status === 'duplicate') {
            notify('info', 'Duplicate mobile number detected — existing record preserved.');
          } else {
            notify('success', `Added ${data.applicantName}`);
          }
        }}
      />

      <WhatsAppModal
        lead={whatsappLead}
        templates={templates}
        defaultCountryCode={defaultCountryCode}
        onClose={() => setWhatsappLead(null)}
        onLogInitiated={async (lead, msg) => {
          await logLeadActivity({
            leadId: lead.id,
            type: 'whatsapp_initiated',
            title: 'WhatsApp follow-up initiated',
            description: msg.slice(0, 200),
            performedBy: currentUser.displayName,
            performedByUid: currentUser.uid,
          });
          notify('info', `Opening WhatsApp for ${lead.applicantName}`);
        }}
      />

      <CallDurationModal
        lead={callState?.lead || null}
        mode={callState?.mode || 'call'}
        defaultCountryCode={defaultCountryCode}
        onClose={() => setCallState(null)}
        onSaveCallLog={async (lead, durationSeconds, newStatus, note) => {
          await updateCallDuration(
            lead.id,
            durationSeconds,
            currentUser.displayName,
            currentUser.uid,
            newStatus
          );
          if (note) {
            await logLeadActivity({
              leadId: lead.id,
              type: 'note_added',
              title: 'Call note added',
              description: note,
              performedBy: currentUser.displayName,
              performedByUid: currentUser.uid,
            });
          }
          notify('success', `Call duration logged for ${lead.applicantName}`);
        }}
      />

      <FileMigrationModal
        open={fileMigrationOpen}
        existingLeads={visibleLeads}
        defaultCountryCode={defaultCountryCode}
        onClose={() => setFileMigrationOpen(false)}
        onCommitImport={async (rows, skipDuplicates) => {
          let created = 0;
          let duplicates = 0;
          let serial = nextSerialNumber;
          const runningLeads = [...allLeads];

          for (const row of rows) {
            const res = await createLeadRecord({
              ...row,
              isDemo: demoMode,
              createdByUid: currentUser.uid,
              createdByName: currentUser.displayName,
              defaultCountryCode,
              existingLeads: skipDuplicates ? runningLeads : [],
              nextSerialNumber: serial,
            });
            if (res.status === 'duplicate') {
              duplicates++;
            } else {
              created++;
              serial++;
              runningLeads.push({
                id: res.leadId,
                serialNumber: serial - 1,
                applicantName: row.applicantName,
                phoneNumber: row.phoneNumber,
                normalizedPhone: row.phoneNumber,
                location: row.location,
                leadSource: row.leadSource,
                contactStatus: row.contactStatus,
                registrationStatus: 'Pending',
                priority: row.priority,
                callDurationSeconds: row.callDurationSeconds,
                isDemo: demoMode,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }

          notify(
            'success',
            `Migration complete: ${created} imported${duplicates ? `, ${duplicates} duplicates skipped` : ''}.`
          );
          return { created, duplicates };
        }}
      />

      <GoogleSheetsSyncModal
        open={sheetsSyncLeads !== null}
        leadsToSync={sheetsSyncLeads || []}
        settings={settings}
        onClose={() => setSheetsSyncLeads(null)}
        onSaveSheetConfig={async (cfg) => {
          await saveWorkshopSettings(cfg);
        }}
        onNotify={notify}
      />

      <LeadDetailDrawer
        lead={selectedLead}
        activities={activities}
        defaultCountryCode={defaultCountryCode}
        canDelete={canDelete}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={async (leadId, updates, activityTitle) => {
          await updateLeadFields(leadId, updates, {
            type:
              updates.contactStatus === 'Registration Confirmed'
                ? 'registration_confirmed'
                : 'lead_updated',
            title: activityTitle || 'Lead updated',
            performedBy: currentUser.displayName,
            performedByUid: currentUser.uid,
          });
          notify('success', 'Lead profile updated');
        }}
        onAddNote={async (lead, noteText) => {
          const updatedNotes = lead.notes
            ? `${lead.notes}\n• ${noteText}`
            : `• ${noteText}`;
          await updateLeadFields(
            lead.id,
            { notes: updatedNotes },
            {
              type: 'note_added',
              title: 'Note added',
              description: noteText,
              performedBy: currentUser.displayName,
              performedByUid: currentUser.uid,
            }
          );
          notify('success', 'Note added to timeline');
        }}
        onOpenWhatsApp={(lead) => setWhatsappLead(lead)}
        onOpenCall={(lead) => setCallState({ lead, mode: 'call' })}
        onDeleteLead={async (lead) => {
          await deleteLeadRecord(lead.id);
          setSelectedLeadId(null);
          notify('success', `Deleted lead ${lead.applicantName}`);
        }}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </div>
  );
}
