import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Upload,
  MessageSquare,
  Globe,
  Table2,
  Users,
  Shield,
  Plus,
  Trash2,
  Check,
  Copy,
  Database,
  Send,
  Megaphone,
} from 'lucide-react';
import type {
  Campaign,
  MessageTemplate,
  TeamInvite,
  UserProfile,
  UserRole,
  WorkshopSettings,
} from '../types/crm';
import { DEFAULT_WHATSAPP_MESSAGE } from '../types/crm';
import { BrandMark } from './BrandMark';

interface SettingsViewProps {
  currentUser: UserProfile;
  settings: WorkshopSettings | null;
  templates: MessageTemplate[];
  campaigns: Campaign[];
  users: UserProfile[];
  invites: TeamInvite[];
  demoMode: boolean;
  demoCount: number;
  onSaveSettings: (updates: Partial<WorkshopSettings>) => Promise<void>;
  onSaveTemplate: (tpl: {
    id?: string;
    name: string;
    body: string;
    isDefault: boolean;
  }) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onCreateCampaign: (data: {
    name: string;
    source: string;
    utmCampaign: string;
    status: 'Active' | 'Paused' | 'Completed';
  }) => Promise<void>;
  onUpdateCampaignStatus: (
    id: string,
    status: 'Active' | 'Paused' | 'Completed'
  ) => Promise<void>;
  onInviteUser: (
    email: string,
    role: 'super_admin' | 'manager' | 'staff',
    displayName: string
  ) => Promise<void>;
  onDeleteInvite: (id: string) => Promise<void>;
  onUpdateUserRole: (uid: string, role: UserRole, isActive: boolean) => Promise<void>;
  onToggleDemoMode: (enable: boolean) => Promise<void>;
  onClearDemoData: () => Promise<void>;
  onOpenGoogleSheetsSync: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type SettingsTab =
  | 'institute'
  | 'templates'
  | 'integrations'
  | 'campaigns'
  | 'team'
  | 'privacy';

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  settings,
  templates,
  campaigns,
  users,
  invites,
  demoMode,
  demoCount,
  onSaveSettings,
  onSaveTemplate,
  onDeleteTemplate,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onInviteUser,
  onDeleteInvite,
  onUpdateUserRole,
  onToggleDemoMode,
  onClearDemoData,
  onOpenGoogleSheetsSync,
  onNotify,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isManagerOrAdmin =
    currentUser.role === 'super_admin' || currentUser.role === 'manager';

  const [tab, setTab] = useState<SettingsTab>('institute');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Institute settings state
  const [instituteName, setInstituteName] = useState(
    settings?.instituteName || 'SHRI V.M. JOSHI INSTITUTE'
  );
  const [workshopName, setWorkshopName] = useState(
    settings?.workshopName || 'Yantra Shastra Masterclass'
  );
  const [logoDataUrl, setLogoDataUrl] = useState(settings?.logoDataUrl || '');
  const [countryCode, setCountryCode] = useState(settings?.defaultCountryCode || '+91');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>(
    settings?.exportDefaultFormat || 'xlsx'
  );
  const [webhookKey, setWebhookKey] = useState(settings?.googleAdsWebhookKey || '');
  const [privacyPolicyText, setPrivacyPolicyText] = useState(
    settings?.privacyPolicyText || ''
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // Template composer
  const [tplName, setTplName] = useState('');
  const [tplBody, setTplBody] = useState(DEFAULT_WHATSAPP_MESSAGE);
  const [tplDefault, setTplDefault] = useState(false);

  // Campaign composer
  const [campName, setCampName] = useState('');
  const [campSource, setCampSource] = useState('Google Ads');
  const [campUtm, setCampUtm] = useState('');

  // Team invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'super_admin' | 'manager' | 'staff'>('staff');
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    if (settings) {
      setInstituteName(settings.instituteName || 'SHRI V.M. JOSHI INSTITUTE');
      setWorkshopName(settings.workshopName || 'Yantra Shastra Masterclass');
      setLogoDataUrl(settings.logoDataUrl || '');
      setCountryCode(settings.defaultCountryCode || '+91');
      setExportFormat(settings.exportDefaultFormat || 'xlsx');
      setWebhookKey(settings.googleAdsWebhookKey || '');
      setPrivacyPolicyText(settings.privacyPolicyText || '');
    }
  }, [settings]);

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setLogoDataUrl(canvas.toDataURL('image/png'));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSavingSettings(true);
    try {
      await onSaveSettings({
        instituteName: instituteName.trim(),
        workshopName: workshopName.trim(),
        logoDataUrl,
        defaultCountryCode: countryCode.trim() || '+91',
        exportDefaultFormat: exportFormat,
        googleAdsWebhookKey: webhookKey.trim(),
        privacyPolicyText: privacyPolicyText.trim(),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestGoogleAdsWebhook = async () => {
    if (!webhookKey) {
      onNotify('error', 'Configure a Webhook Verification Key first.');
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch('/api/webhooks/google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_key: webhookKey,
          lead_id: `gads_test_${Date.now()}`,
          campaign_id: '2026_yantra_search',
          campaign_name: 'Yantra Masterclass – Search India',
          gclid: `EAIaIQob_TEST_${Math.random().toString(36).slice(2, 8)}`,
          user_column_data: [
            { column_id: 'FULL_NAME', string_value: 'Test Webhook Applicant' },
            {
              column_id: 'PHONE_NUMBER',
              string_value: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`,
            },
            { column_id: 'CITY', string_value: 'Pune' },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Webhook test failed');
      onNotify('success', `Google Ads webhook verified (${data.status}: Lead #${data.serialNumber || ''})`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Webhook verification failed');
    } finally {
      setTestingWebhook(false);
    }
  };

  const webhookEndpoint = `${window.location.origin}/api/webhooks/google-ads`;
  const landingEndpoint = `${window.location.origin}/api/leads/ingest`;

  return (
    <div className="space-y-5">
      {/* Settings Navigation Tabs */}
      <div className="bg-white border border-[#E7E2D8] rounded-xl p-2 flex flex-wrap gap-1.5">
        {(
          [
            ['institute', 'Institute & Branding', Building2],
            ['templates', 'WhatsApp Templates', MessageSquare],
            ['integrations', 'Google Ads & Sheets', Globe],
            ['campaigns', 'Campaigns', Megaphone],
            ['team', 'Team & Roles', Users],
            ['privacy', 'Demo Mode & Privacy', Shield],
          ] as Array<[SettingsTab, string, React.ComponentType<{ className?: string }>]>
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              tab === key
                ? 'bg-[#1E1C1A] text-white'
                : 'text-[#57514A] hover:bg-[#F8F7F4] hover:text-[#1E1C1A]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Institute & Branding */}
      {tab === 'institute' && (
        <form
          onSubmit={handleSaveGeneral}
          className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#E7E2D8] pb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#1E1C1A]">
                Institute Identity &amp; Defaults
              </h3>
              <p className="text-xs text-[#6B645B]">
                Customize institute branding, logo, phone country code, and export defaults.
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold text-[#1E1C1A]">{currentUser.displayName}</p>
              <p className="text-[#6B645B] capitalize">Role: {currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <BrandMark logoDataUrl={logoDataUrl} size="lg" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#1E1C1A]">Institute Logo</p>
              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
                <button
                  type="button"
                  disabled={!isSuperAdmin}
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-[#D6D0C4] bg-[#FBF9F5] hover:border-[#B08942] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo</span>
                </button>
                {logoDataUrl && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl('')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Restore Yantra Emblem
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Institute Name
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg disabled:bg-[#F8F7F4]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Workshop / Masterclass Name
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg disabled:bg-[#F8F7F4]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Default Phone Country Code
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="+91"
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D0C4] rounded-lg disabled:bg-[#F8F7F4]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                Default Export Format
              </label>
              <select
                disabled={!isSuperAdmin}
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'xlsx')}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg disabled:bg-[#F8F7F4]"
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-lg bg-[#1E1C1A] hover:bg-[#322D28] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 text-[#D4AF6A]" />
                <span>{savingSettings ? 'Saving...' : 'Save Institute Settings'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* WhatsApp Templates */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Saved WhatsApp Templates
            </h3>
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-[#E7E2D8] bg-[#FBF9F5] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#1E1C1A]">
                      {t.name} {t.isDefault ? '· Default' : ''}
                    </p>
                    {isManagerOrAdmin && (
                      <div className="flex items-center gap-2">
                        {!t.isDefault && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveTemplate({
                                id: t.id,
                                name: t.name,
                                body: t.body,
                                isDefault: true,
                              })
                            }
                            className="text-[11px] font-semibold text-[#9A7230] hover:underline"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(t.id)}
                          className="text-red-700 hover:text-red-800 p-1"
                          aria-label="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#4A443D] whitespace-pre-wrap leading-relaxed">
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {isManagerOrAdmin && (
            <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Create New WhatsApp Template
              </h3>
              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g., Fee Details Follow-up"
                  className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                  Message Content
                </label>
                <textarea
                  rows={7}
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#1E1C1A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={tplDefault}
                  onChange={(e) => setTplDefault(e.target.checked)}
                />
                <span>Make this the default WhatsApp template</span>
              </label>
              <button
                type="button"
                disabled={!tplName.trim() || !tplBody.trim()}
                onClick={async () => {
                  await onSaveTemplate({
                    name: tplName.trim(),
                    body: tplBody.trim(),
                    isDefault: tplDefault,
                  });
                  setTplName('');
                  setTplDefault(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Google Ads & Google Sheets Integrations */}
      {tab === 'integrations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Google Ads */}
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Google Ads Lead Ingestion &amp; Webhook
            </h3>
            <p className="text-xs text-[#6B645B] leading-relaxed">
              Connect Google Ads Lead Form extensions or external landing pages securely. Duplicate submissions by phone number are preserved without overwriting existing records.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Google Ads Lead Form Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookEndpoint}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-[#F8F7F4] border border-[#D6D0C4] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookEndpoint);
                    onNotify('info', 'Webhook URL copied');
                  }}
                  className="px-3 py-2 border border-[#D6D0C4] rounded-lg bg-white hover:bg-[#F8F7F4]"
                  aria-label="Copy webhook URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Landing Page Ingestion API (POST)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={landingEndpoint}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-[#F8F7F4] border border-[#D6D0C4] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(landingEndpoint);
                    onNotify('info', 'Landing API URL copied');
                  }}
                  className="px-3 py-2 border border-[#D6D0C4] rounded-lg bg-white hover:bg-[#F8F7F4]"
                  aria-label="Copy landing API URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57514A] mb-1">
                Webhook Verification Key (google_key)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={webhookKey}
                  onChange={(e) => setWebhookKey(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono border border-[#D6D0C4] rounded-lg disabled:bg-[#F8F7F4]"
                />
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => onSaveSettings({ googleAdsWebhookKey: webhookKey.trim() })}
                    className="px-3 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold"
                  >
                    Save Key
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={testingWebhook}
              onClick={handleTestGoogleAdsWebhook}
              className="px-4 py-2 rounded-lg border border-[#B08942] bg-[#FBF9F5] hover:bg-[#F1EDE4] text-xs font-semibold text-[#7D5B22] flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testingWebhook ? 'Sending Test Ping...' : 'Send Test Google Ads Webhook Lead'}</span>
            </button>
          </div>

          {/* Google Sheets Integration */}
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Google Sheets Synchronization
            </h3>
            <p className="text-xs text-[#6B645B] leading-relaxed">
              Connect your Google account, pick or create a Google Spreadsheet, and synchronize existing and newly captured leads with automatic duplicate protection.
            </p>

            <div className="p-4 rounded-xl bg-[#F8F7F4] border border-[#E7E2D8] space-y-1.5 text-xs">
              <div>
                <span className="text-[#6B645B]">Connected Spreadsheet: </span>
                <span className="font-semibold text-[#1E1C1A]">
                  {settings?.googleSheetTitle || 'Not connected yet'}
                </span>
              </div>
              <div>
                <span className="text-[#6B645B]">Sheet Tab: </span>
                <span className="font-mono text-[#1E1C1A]">
                  {settings?.googleSheetTabName || 'Leads'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenGoogleSheetsSync}
              className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2"
            >
              <Table2 className="w-4 h-4" />
              <span>Configure &amp; Sync Google Sheets</span>
            </button>
          </div>
        </div>
      )}

      {/* Campaigns */}
      {tab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Tracked Campaigns ({campaigns.length})
            </h3>
            {campaigns.length === 0 ? (
              <p className="text-xs text-[#6B645B]">No manual campaigns registered yet.</p>
            ) : (
              <div className="space-y-2.5">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#1E1C1A]">{c.name}</p>
                      <p className="text-[11px] text-[#6B645B]">
                        {c.source} {c.utmCampaign ? `· utm: ${c.utmCampaign}` : ''}
                      </p>
                    </div>
                    {isManagerOrAdmin && (
                      <select
                        value={c.status}
                        onChange={(e) =>
                          onUpdateCampaignStatus(
                            c.id,
                            e.target.value as 'Active' | 'Paused' | 'Completed'
                          )
                        }
                        className="px-2.5 py-1 text-xs bg-white border border-[#D6D0C4] rounded-lg"
                      >
                        <option value="Active">Active</option>
                        <option value="Paused">Paused</option>
                        <option value="Completed">Completed</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isManagerOrAdmin && (
            <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Add Google Ads Campaign
              </h3>
              <div>
                <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="e.g., Yantra Shastra – Pune Search"
                  className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                    Source
                  </label>
                  <input
                    type="text"
                    value={campSource}
                    onChange={(e) => setCampSource(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A443D] mb-1">
                    UTM Campaign Slug
                  </label>
                  <input
                    type="text"
                    value={campUtm}
                    onChange={(e) => setCampUtm(e.target.value)}
                    placeholder="yantra_pune_2026"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D6D0C4] rounded-lg"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!campName.trim()}
                onClick={async () => {
                  await onCreateCampaign({
                    name: campName.trim(),
                    source: campSource.trim() || 'Google Ads',
                    utmCampaign: campUtm.trim(),
                    status: 'Active',
                  });
                  setCampName('');
                  setCampUtm('');
                }}
                className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Campaign</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Team & Role-Based Access */}
      {tab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Authorized CRM Team
            </h3>
            {!isSuperAdmin ? (
              <p className="text-xs text-[#6B645B]">
                Only Super Admins can view and modify team access roles. Your current role is{' '}
                <strong className="capitalize">{currentUser.role.replace('_', ' ')}</strong>.
              </p>
            ) : (
              <div className="space-y-2.5">
                {users.map((u) => (
                  <div
                    key={u.uid}
                    className="p-3.5 rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#1E1C1A]">{u.displayName}</p>
                      <p className="text-[11px] font-mono text-[#6B645B]">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          onUpdateUserRole(u.uid, e.target.value as UserRole, e.target.value !== 'pending')
                        }
                        className="px-2 py-1 text-xs bg-white border border-[#D6D0C4] rounded-lg"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                        <option value="pending">Revoked / Pending</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Authorize Staff / Manager Email
              </h3>
              <p className="text-xs text-[#6B645B]">
                Pre-authorize an institute staff member so they receive their assigned role immediately upon signing in with Google.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Staff Name"
                  className="px-3 py-2 text-sm border border-[#D6D0C4] rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'super_admin' | 'manager' | 'staff')
                  }
                  className="px-3 py-2 text-sm bg-white border border-[#D6D0C4] rounded-lg"
                >
                  <option value="staff">Staff (View, Call, WhatsApp, Edit Status)</option>
                  <option value="manager">Manager (Includes Export, Import, Delete)</option>
                  <option value="super_admin">Super Admin (Full Control)</option>
                </select>
                <button
                  type="button"
                  disabled={!inviteEmail.trim()}
                  onClick={async () => {
                    await onInviteUser(inviteEmail, inviteRole, inviteName);
                    setInviteEmail('');
                    setInviteName('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold disabled:opacity-50"
                >
                  Authorize Email
                </button>
              </div>

              {invites.length > 0 && (
                <div className="pt-3 border-t border-[#E7E2D8] space-y-2">
                  <p className="text-xs font-semibold text-[#57514A]">Pre-Authorized Emails</p>
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#F8F7F4] border border-[#E7E2D8]"
                    >
                      <span>
                        <strong className="font-mono">{inv.email}</strong> · {inv.role}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteInvite(inv.id)}
                        className="text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Demo Mode & Privacy */}
      {tab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#9A7230]" />
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Isolated Demo Mode
              </h3>
            </div>
            <p className="text-xs text-[#6B645B] leading-relaxed">
              Demo Mode lets you evaluate dashboard charts, call durations, WhatsApp templates, and exports with realistic sample leads kept strictly separate from live Google Ads leads.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleDemoMode(!demoMode)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  demoMode
                    ? 'bg-[#B08942] text-white'
                    : 'bg-[#1E1C1A] text-white'
                }`}
              >
                {demoMode ? 'Exit Demo Mode (Show Real Leads)' : 'Enter Demo Mode'}
              </button>
              {demoCount > 0 && (
                <button
                  type="button"
                  onClick={onClearDemoData}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                >
                  Clear Demo Leads ({demoCount})
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Consent &amp; Privacy Policy Text
            </h3>
            <textarea
              rows={5}
              disabled={!isSuperAdmin}
              value={privacyPolicyText}
              onChange={(e) => setPrivacyPolicyText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D6D0C4] rounded-lg leading-relaxed disabled:bg-[#F8F7F4]"
            />
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => onSaveSettings({ privacyPolicyText: privacyPolicyText.trim() })}
                className="px-4 py-2 rounded-lg bg-[#1E1C1A] text-white text-xs font-semibold"
              >
                Update Privacy Policy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
