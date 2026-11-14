import React, { useMemo, useState } from 'react';
import {
  Users,
  Sparkles,
  PhoneCall,
  Clock,
  HeartHandshake,
  CheckCircle2,
  UserX,
  TrendingUp,
  Download,
  AlertCircle,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import type { Lead } from '../types/crm';
import { downloadLeadsAsExcel } from '../services/exportService';
import { formatDurationSeconds } from '../utils/phone';

interface DashboardAnalyticsProps {
  leads: Lead[];
  onNavigateToLeads: (statusFilter?: string) => void;
  onNavigateToFollowUps: () => void;
  onSelectLead: (lead: Lead) => void;
  onLoadDemoContacts?: () => void;
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  leads,
  onNavigateToLeads,
  onNavigateToFollowUps,
  onSelectLead,
  onLoadDemoContacts,
}) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter leads by selected period
  const { filteredLeads, previousLeads } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 86400_000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (datePreset === 'all') {
      return { filteredLeads: leads, previousLeads: [] as Lead[] };
    }

    let fromMs = 0;
    let toMs = Date.now() + 86400_000;
    if (datePreset === 'today') {
      fromMs = startOfToday;
    } else if (datePreset === 'week') {
      fromMs = startOfWeek;
    } else if (datePreset === 'month') {
      fromMs = startOfMonth;
    } else if (datePreset === 'custom') {
      fromMs = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0;
      toMs = customTo ? new Date(customTo + 'T23:59:59').getTime() : Date.now() + 86400_000;
    }

    const span = Math.max(86400_000, toMs - fromMs);
    const prevFromMs = fromMs - span;

    const current = leads.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= fromMs && t <= toMs;
    });
    const prev = leads.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= prevFromMs && t < fromMs;
    });

    return { filteredLeads: current, previousLeads: prev };
  }, [leads, datePreset, customFrom, customTo]);

  // Real-time KPI calculations
  const kpis = useMemo(() => {
    const calc = (list: Lead[]) => {
      const total = list.length;
      const newLeads = list.filter((l) => l.contactStatus === 'New Lead').length;
      const contacted = list.filter((l) =>
        [
          'Call Received',
          'Call Connected',
          'Called Back',
          'Follow-up Required',
          'Interested',
          'Registration Confirmed',
        ].includes(l.contactStatus)
      ).length;
      const followUpPending = list.filter(
        (l) =>
          l.contactStatus === 'Follow-up Required' ||
          (l.followUpDate && !l.followUpCompleted)
      ).length;
      const interested = list.filter((l) => l.contactStatus === 'Interested').length;
      const confirmed = list.filter(
        (l) =>
          l.contactStatus === 'Registration Confirmed' ||
          l.registrationStatus === 'Registered'
      ).length;
      const notInterested = list.filter((l) => l.contactStatus === 'Not Interested').length;
      const conversionRate = total > 0 ? (confirmed / total) * 100 : 0;
      return {
        total,
        newLeads,
        contacted,
        followUpPending,
        interested,
        confirmed,
        notInterested,
        conversionRate,
      };
    };

    const current = calc(filteredLeads);
    const prev = calc(previousLeads);
    const hasPrev = datePreset !== 'all' && previousLeads.length > 0;

    const deltaLabel = (currVal: number, prevVal: number, suffix = '') => {
      if (!hasPrev) return 'Live database count';
      const diff = currVal - prevVal;
      const sign = diff > 0 ? '+' : '';
      return `${sign}${diff.toFixed(suffix ? 1 : 0)}${suffix} vs prior period`;
    };

    return { current, deltaLabel, prev };
  }, [filteredLeads, previousLeads, datePreset]);

  // Period buckets: Today, This Week, This Month
  const periodStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 86400_000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const today = leads.filter((l) => new Date(l.createdAt).getTime() >= todayStart).length;
    const week = leads.filter((l) => new Date(l.createdAt).getTime() >= weekStart).length;
    const month = leads.filter((l) => new Date(l.createdAt).getTime() >= monthStart).length;
    const overdueFollowUps = leads.filter(
      (l) => l.followUpDate && !l.followUpCompleted && l.followUpDate < todayStr
    ).length;
    const todayFollowUps = leads.filter(
      (l) => l.followUpDate && !l.followUpCompleted && l.followUpDate === todayStr
    ).length;
    const totalTalkSecs = filteredLeads.reduce(
      (sum, l) => sum + (Number(l.callDurationSeconds) || 0),
      0
    );

    return { today, week, month, overdueFollowUps, todayFollowUps, totalTalkSecs };
  }, [leads, filteredLeads, todayStr]);

  // Acquisition trend (14 days)
  const trendData = useMemo(() => {
    const days: Array<{ date: string; label: string; count: number; registered: number }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const dayLeads = filteredLeads.filter((l) => l.createdAt.slice(0, 10) === iso);
      days.push({
        date: iso,
        label,
        count: dayLeads.length,
        registered: dayLeads.filter((l) => l.registrationStatus === 'Registered').length,
      });
    }
    const maxCount = Math.max(1, ...days.map((d) => d.count));
    return { days, maxCount };
  }, [filteredLeads]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const groups = [
      { label: 'New Lead', color: '#B08942', count: kpis.current.newLeads },
      { label: 'Interested', color: '#0F766E', count: kpis.current.interested },
      { label: 'Confirmed', color: '#15803D', count: kpis.current.confirmed },
      { label: 'Follow-up Required', color: '#D97706', count: kpis.current.followUpPending },
      { label: 'Not Interested', color: '#B91C1C', count: kpis.current.notInterested },
      {
        label: 'Other Contacted',
        color: '#57514A',
        count: Math.max(
          0,
          filteredLeads.length -
            kpis.current.newLeads -
            kpis.current.interested -
            kpis.current.confirmed -
            kpis.current.notInterested
        ),
      },
    ].filter((g) => g.count > 0);
    return groups;
  }, [filteredLeads.length, kpis.current]);

  // Campaign performance
  const campaignPerf = useMemo(() => {
    const map = new Map<string, { name: string; total: number; registered: number; interested: number }>();
    for (const l of filteredLeads) {
      const name = l.campaignName?.trim() || l.leadSource;
      const entry = map.get(name) || { name, total: 0, registered: 0, interested: 0 };
      entry.total++;
      if (l.registrationStatus === 'Registered' || l.contactStatus === 'Registration Confirmed') {
        entry.registered++;
      }
      if (l.contactStatus === 'Interested') {
        entry.interested++;
      }
      map.set(name, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredLeads]);

  const recentLeads = useMemo(() => leads.slice(0, 5), [leads]);
  const todaysLeads = useMemo(
    () => leads.filter((l) => l.createdAt.slice(0, 10) === todayStr),
    [leads, todayStr]
  );

  const cards = [
    {
      label: 'Total Leads',
      value: kpis.current.total.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.total, kpis.prev.total),
      icon: Users,
      filter: 'All',
    },
    {
      label: 'New Leads',
      value: kpis.current.newLeads.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.newLeads, kpis.prev.newLeads),
      icon: Sparkles,
      filter: 'New Lead',
    },
    {
      label: 'Contacted Leads',
      value: kpis.current.contacted.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.contacted, kpis.prev.contacted),
      icon: PhoneCall,
      filter: 'Call Connected',
    },
    {
      label: 'Follow-up Pending',
      value: kpis.current.followUpPending.toLocaleString('en-IN'),
      sub: `${periodStats.overdueFollowUps} overdue · ${periodStats.todayFollowUps} due today`,
      icon: Clock,
      filter: 'Follow-up Required',
    },
    {
      label: 'Interested Leads',
      value: kpis.current.interested.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.interested, kpis.prev.interested),
      icon: HeartHandshake,
      filter: 'Interested',
    },
    {
      label: 'Confirmed Registrations',
      value: kpis.current.confirmed.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.confirmed, kpis.prev.confirmed),
      icon: CheckCircle2,
      filter: 'Registration Confirmed',
    },
    {
      label: 'Not Interested',
      value: kpis.current.notInterested.toLocaleString('en-IN'),
      sub: kpis.deltaLabel(kpis.current.notInterested, kpis.prev.notInterested),
      icon: UserX,
      filter: 'Not Interested',
    },
    {
      label: 'Conversion Rate',
      value: `${kpis.current.conversionRate.toFixed(1)}%`,
      sub: kpis.deltaLabel(kpis.current.conversionRate, kpis.prev.conversionRate, '%'),
      icon: TrendingUp,
      filter: 'Registration Confirmed',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Analytics Filter & Daily Report Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#E7E2D8] rounded-xl px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#57514A] flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-[#9A7230]" />
            <span>Period:</span>
          </span>
          {(
            [
              ['all', 'All Time'],
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['custom', 'Custom Range'],
            ] as Array<[DatePreset, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDatePreset(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                datePreset === key
                  ? 'bg-[#1E1C1A] text-white'
                  : 'bg-[#F8F7F4] text-[#57514A] hover:text-[#1E1C1A]'
              }`}
            >
              {label}
            </button>
          ))}

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[#D6D0C4] rounded-lg bg-white"
              />
              <span className="text-xs text-[#78716C]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[#D6D0C4] rounded-lg bg-white"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            downloadLeadsAsExcel(
              todaysLeads.length > 0 ? todaysLeads : filteredLeads,
              todaysLeads.length > 0 ? 'daily-lead-report' : 'yantra-period-report'
            )
          }
          disabled={filteredLeads.length === 0}
          className="px-3.5 py-2 rounded-lg border border-[#D6D0C4] bg-[#FBF9F5] hover:border-[#B08942] text-xs font-semibold text-[#1E1C1A] flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#9A7230]" />
          <span>
            {todaysLeads.length > 0
              ? `Daily Report (${todaysLeads.length})`
              : 'Download Period Report'}
          </span>
        </button>
      </div>

      {/* Overdue / Pending Follow-ups Indicator Strip */}
      {(periodStats.overdueFollowUps > 0 || periodStats.todayFollowUps > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2.5 text-xs text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong className="font-semibold tabular-nums">
                {periodStats.overdueFollowUps} overdue
              </strong>{' '}
              and{' '}
              <strong className="font-semibold tabular-nums">
                {periodStats.todayFollowUps} due today
              </strong>{' '}
              workshop follow-up reminder(s) require attention.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToFollowUps}
            className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            <span>Open Follow-up Queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 8 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigateToLeads(card.filter)}
              className="text-left bg-white border border-[#E7E2D8] hover:border-[#B08942]/70 rounded-xl p-5 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#57514A]">{card.label}</span>
                <span className="w-8 h-8 rounded-lg bg-[#F8F7F4] border border-[#E7E2D8] flex items-center justify-center text-[#9A7230]">
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold text-[#1E1C1A] tabular-nums tracking-tight">
                  {card.value}
                </p>
                <p className="text-[11px] text-[#78716C] mt-1">{card.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Period Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-[#E7E2D8] rounded-xl p-4">
        <div className="px-2">
          <p className="text-[11px] font-semibold text-[#6B645B]">Collected Today</p>
          <p className="text-xl font-display font-semibold text-[#1E1C1A] tabular-nums mt-0.5">
            {periodStats.today}
          </p>
        </div>
        <div className="px-2 border-l border-[#E7E2D8]">
          <p className="text-[11px] font-semibold text-[#6B645B]">Collected This Week</p>
          <p className="text-xl font-display font-semibold text-[#1E1C1A] tabular-nums mt-0.5">
            {periodStats.week}
          </p>
        </div>
        <div className="px-2 md:border-l border-[#E7E2D8]">
          <p className="text-[11px] font-semibold text-[#6B645B]">Collected This Month</p>
          <p className="text-xl font-display font-semibold text-[#1E1C1A] tabular-nums mt-0.5">
            {periodStats.month}
          </p>
        </div>
        <div className="px-2 border-l border-[#E7E2D8]">
          <p className="text-[11px] font-semibold text-[#6B645B]">Total Recorded Talk Time</p>
          <p className="text-xl font-mono font-semibold text-[#1E1C1A] tabular-nums mt-0.5">
            {formatDurationSeconds(periodStats.totalTalkSecs)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lead Acquisition Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E7E2D8] rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Lead Acquisition Trend (Last 14 Days)
              </h3>
              <p className="text-xs text-[#6B645B]">
                Daily captured leads vs confirmed registrations
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#57514A]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B08942]" />
                Total Leads
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1E1C1A]" />
                Registered
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end gap-1.5 sm:gap-2.5 pt-6">
            {trendData.days.map((day) => {
              const totalH = Math.max(4, Math.round((day.count / trendData.maxCount) * 100));
              const regH =
                day.count > 0 ? Math.round((day.registered / trendData.maxCount) * 100) : 0;
              const isHovered = hoveredDay === day.date;

              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className="relative flex-1 flex flex-col items-center h-full justify-end group"
                >
                  {isHovered && (
                    <div className="absolute -top-2 z-10 px-2 py-1 rounded bg-[#1E1C1A] text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow">
                      {day.label}: {day.count} lead{day.count === 1 ? '' : 's'} ({day.registered} reg)
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center gap-0.5 h-40">
                    <div
                      style={{ height: `${day.count === 0 ? 3 : totalH}%` }}
                      className={`w-full max-w-[16px] rounded-t transition-opacity ${
                        day.count === 0
                          ? 'bg-[#EAE5DA]'
                          : 'bg-[#B08942]/85 group-hover:bg-[#B08942]'
                      }`}
                    />
                    {day.registered > 0 && (
                      <div
                        style={{ height: `${Math.max(6, regH)}%` }}
                        className="w-full max-w-[10px] rounded-t bg-[#1E1C1A]"
                      />
                    )}
                  </div>
                  <span className="mt-2 text-[10px] text-[#78716C] font-mono tabular-nums truncate w-full text-center">
                    {day.label.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Status Distribution */}
        <div className="bg-white border border-[#E7E2D8] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
              Lead Status Distribution
            </h3>
            <p className="text-xs text-[#6B645B] mb-5">
              Breakdown across pipeline stages
            </p>

            {filteredLeads.length === 0 ? (
              <p className="text-xs text-[#78716C] py-12 text-center">
                No leads recorded for this period yet.
              </p>
            ) : (
              <div className="space-y-3">
                {statusDistribution.map((item) => {
                  const pct = Math.round((item.count / filteredLeads.length) * 100);
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#1E1C1A]">{item.label}</span>
                        <span className="font-mono tabular-nums text-[#57514A]">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#F1EDE4] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Performance + Recently Added Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Campaign Performance */}
        <div className="bg-white border border-[#E7E2D8] rounded-xl p-6">
          <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
            Campaign Performance
          </h3>
          <p className="text-xs text-[#6B645B] mb-4">
            Google Ads &amp; acquisition source conversion comparison
          </p>

          {campaignPerf.length === 0 ? (
            <p className="text-xs text-[#78716C] py-8 text-center">
              Campaign metrics appear automatically once leads arrive.
            </p>
          ) : (
            <div className="space-y-3">
              {campaignPerf.map((camp) => {
                const rate = camp.total > 0 ? Math.round((camp.registered / camp.total) * 100) : 0;
                const widthPct = Math.round(
                  (camp.total / Math.max(1, campaignPerf[0].total)) * 100
                );
                return (
                  <div key={camp.name} className="p-3 rounded-lg bg-[#FBF9F5] border border-[#E7E2D8]">
                    <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                      <span className="font-semibold text-[#1E1C1A] truncate">{camp.name}</span>
                      <span className="font-mono tabular-nums text-[#57514A] shrink-0">
                        {camp.total} leads · {camp.registered} reg ({rate}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#EAE5DA] overflow-hidden">
                      <div
                        className="h-full bg-[#1E1C1A] rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Added Leads */}
        <div className="bg-white border border-[#E7E2D8] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-[#1E1C1A]">
                Recently Added Leads
              </h3>
              <p className="text-xs text-[#6B645B]">Latest enquiries captured in the CRM</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToLeads('All')}
              className="text-xs font-semibold text-[#9A7230] hover:underline"
            >
              View All
            </button>
          </div>

          {recentLeads.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-xs text-[#78716C]">
                No workshop leads yet. Add a lead, import an existing file, or load sample contacts for a trial.
              </p>
              {onLoadDemoContacts && (
                <button
                  type="button"
                  onClick={onLoadDemoContacts}
                  className="px-3.5 py-2 rounded-lg border border-[#B08942] bg-[#FBF9F5] text-[#7D5B22] text-xs font-semibold hover:bg-[#F3ECE0] transition-colors"
                >
                  Load Trial Demo Contacts
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#E7E2D8]">
              {recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelectLead(lead)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FBF9F5] px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1E1C1A] truncate">
                      {lead.applicantName}
                    </p>
                    <p className="text-xs text-[#6B645B] truncate">
                      <span className="font-mono tabular-nums">{lead.phoneNumber}</span> ·{' '}
                      {lead.location || 'Location pending'} · {lead.leadSource}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#1E1C1A]">{lead.contactStatus}</p>
                    <p className="text-[11px] font-mono tabular-nums text-[#78716C]">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
