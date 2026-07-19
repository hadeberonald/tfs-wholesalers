// app/[slug]/admin/whatsapp/_page.tsx
'use client';

import { useState, useEffect, useMemo, useRef, forwardRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FileText, Upload, ExternalLink, Download, FileDown,
  MessageSquare, MessageSquareText, CheckCheck, Users, Headphones, MousePointerClick,
  TrendingUp, TrendingDown, Minus, Sparkles, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

type Period = 'week' | 'month' | 'custom';

// ─── Design system: orange + grey, everywhere ───────────────────────────────
// One palette, reused for every chart so the on-screen dashboard and the
// exported PDF always look like the same report.
const C = {
  orange: '#f97316',
  orangeDark: '#c2410c',
  orangeLight: '#fdba74',
  orangeSoft: '#ffedd5',
  grey900: '#1e293b',
  grey700: '#475569',
  grey500: '#64748b',
  grey400: '#94a3b8',
  grey300: '#cbd5e1',
  grey200: '#e2e8f0',
  grey100: '#f1f5f9',
};
// Rotation used for doughnut/bar segments with more than 2 categories.
const SERIES = [C.orange, C.grey700, C.orangeLight, C.grey400, C.orangeDark, C.grey300];

function rangeForPeriod(period: Period, custom: { from: string; to: string }) {
  const now = new Date();
  if (period === 'week') {
    const to = now;
    const from = new Date(now.getTime() - 7 * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return {
    from: custom.from ? new Date(custom.from).toISOString() : new Date(now.getTime() - 7 * 86400000).toISOString(),
    to: custom.to ? new Date(custom.to).toISOString() : now.toISOString(),
  };
}

function fmt(n: number | undefined | null) {
  if (n == null) return '0';
  return n.toLocaleString();
}

function fmtMoney(n: number | undefined | null, currency: string) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR' }).format(n);
}

const ENGAGEMENT_LABELS: Record<string, string> = {
  main_menu: 'Main Menu',
  promotions: 'Promotions Menu Views',
  retail_promo: 'Retail Promotions Views',
  wholesale_promo: 'Wholesale Promotions Views',
  specials: 'Daily Specials Views',
  support: 'Customer Support',
  order: 'Order Started',
  location: 'Location Views',
};

const PROMO_LABELS: Record<string, string> = {
  retail_promo: 'Retail Promotion',
  wholesale_promo: 'Wholesale Promotion',
  daily_specials: 'Daily Specials',
};

const PRICING_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  utility: 'Utility',
  service: 'Service',
  authentication: 'Authentication',
};

// ─── Shared bits: growth badge, section headers, doughnut + bar primitives ──

function GrowthBadge({ value, label = 'vs last period' }: { value: number | null | undefined; label?: string }) {
  if (value === undefined) return null;
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <Sparkles className="w-3 h-3" /> New
      </span>
    );
  }
  const flat = Math.abs(value) < 0.1;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        flat ? 'text-slate-400' : up ? 'text-orange-600' : 'text-slate-500'
      }`}
      title={label}
    >
      {flat ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {flat ? '0%' : `${up ? '+' : ''}${value}%`}
    </span>
  );
}

function SectionHeader({ title, subtitle, growth }: { title: string; subtitle?: string; growth?: number | null }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {growth !== undefined && <GrowthBadge value={growth} />}
    </div>
  );
}

function Legend({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
          <span>{it.label}</span>
          <span className="font-semibold text-slate-800">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Slim hollow doughnut with a stat centered in the hole. The go-to chart
 * for every "breakdown with a headline number" panel in this report. */
function DoughnutCard({
  title, subtitle, segments, centerValue, centerLabel, height = 200, growth,
}: {
  title: string;
  subtitle?: string;
  segments: { label: string; value: number; color: string }[];
  centerValue: string | number;
  centerLabel: string;
  height?: number;
  growth?: number | null;
}) {
  const data = segments.map((s) => ({ name: s.label, value: s.value }));
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white h-full">
      <SectionHeader title={title} subtitle={subtitle} growth={growth} />
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmt(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-slate-900 leading-none">{centerValue}</div>
          <div className="text-[11px] text-slate-400 mt-1 text-center px-4">{centerLabel}</div>
        </div>
      </div>
      <Legend items={segments} />
    </div>
  );
}

/** Slim vertical bar chart, one or two series. */
function SlimBarChart({
  title, subtitle, data, bars, height = 220, growth, layout = 'vertical',
}: {
  title: string;
  subtitle?: string;
  data: any[];
  bars: { key: string; color: string; label: string }[];
  height?: number;
  growth?: number | null;
  layout?: 'vertical' | 'horizontal'; // 'horizontal' = bars run left-to-right
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white h-full">
      <SectionHeader title={title} subtitle={subtitle} growth={growth} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {layout === 'horizontal' ? (
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.grey200} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.grey500 }} axisLine={{ stroke: C.grey200 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.grey700 }} width={140} axisLine={{ stroke: C.grey200 }} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: C.grey100 }} />
              {bars.map((b) => (
                <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[0, 6, 6, 0]} barSize={14} />
              ))}
            </BarChart>
          ) : (
            <BarChart data={data} barCategoryGap="35%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grey200} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.grey500 }} axisLine={{ stroke: C.grey200 }} />
              <YAxis tick={{ fontSize: 11, fill: C.grey500 }} axisLine={{ stroke: C.grey200 }} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: C.grey100 }} />
              {bars.map((b) => (
                <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[6, 6, 0, 0]} barSize={16} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <Legend items={bars.map((b) => ({
        label: b.label,
        color: b.color,
        value: data.reduce((sum, d) => sum + (d[b.key] || 0), 0),
      }))} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, growth }: { icon?: any; label: string; value: number | string; growth?: number | null }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5 text-orange-500" />} {label}
      </div>
      <div className="flex items-end justify-between mt-1">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
    </div>
  );
}

// ─── Report page content (used both on-screen and inside the PDF export) ───

function Page1Messages({ data }: { data: any }) {
  const dailySplit = (data.dailyMessageTypeSeries || []).map((d: any) => ({ name: d.date.slice(5), sent: d.sent, received: d.received }));
  const deliveryRate = data.deliveryRate ?? 0;
  const kindData = data.messageKindBreakdown || {};
  const kindTotal = (kindData.template || 0) + (kindData.chatbot || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlimBarChart
        title="WhatsApp Messages Received vs Messages Sent"
        subtitle="Daily volume for the selected period"
        data={dailySplit}
        growth={data.growth?.messagesSent}
        bars={[
          { key: 'received', label: 'Total WA Messages Received', color: C.grey500 },
          { key: 'sent', label: 'Total WA Messages Sent', color: C.orange },
        ]}
        height={300}
      />
      <div className="grid grid-rows-2 gap-4">
        <DoughnutCard
          title="WhatsApp Messages Sent Breakdown"
          centerValue={`${deliveryRate}%`}
          centerLabel="Delivery Rate"
          growth={data.growth?.deliveryRate}
          segments={[
            { label: 'Total WA Messages Sent', value: data.messagesSent || 0, color: C.orange },
            { label: 'Total WA Delivered', value: data.messagesDelivered || 0, color: C.grey500 },
          ]}
          height={140}
        />
        <DoughnutCard
          title="WhatsApp Template & Chatbot Messages"
          centerValue={fmt(kindTotal)}
          centerLabel="Total Messages Sent"
          segments={[
            { label: 'Template Messages Sent', value: kindData.template || 0, color: C.orangeDark },
            { label: 'Chatbot Response Message Sent', value: kindData.chatbot || 0, color: C.grey400 },
          ]}
          height={140}
        />
      </div>
    </div>
  );
}

function Page2Engagement({ data }: { data: any }) {
  const engagementRows = [
    { name: 'Main Menu', value: data.totalsByType?.menu_viewed || 0 },
    ...Object.entries(data.pageEngagements || {}).map(([key, count]: any) => ({
      name: ENGAGEMENT_LABELS[key] || key.replace(/_/g, ' '),
      value: count,
    })),
  ].sort((a, b) => b.value - a.value);

  const promoSegments = Object.entries(data.promoBreakdown || {}).map(([key, v]: any, i) => ({
    label: PROMO_LABELS[key] || key.replace(/_/g, ' '),
    value: v.sent || 0,
    color: SERIES[i % SERIES.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlimBarChart
        title="Engagements Per Page Breakdown"
        subtitle="Main menu, promotions, specials, support & more"
        data={engagementRows}
        layout="horizontal"
        growth={data.growth?.uniqueEngagements}
        bars={[{ key: 'value', label: 'Engagements', color: C.orange }]}
        height={Math.max(220, engagementRows.length * 32)}
      />
      <DoughnutCard
        title="Promotions Downloaded Breakdown"
        subtitle="Retail, wholesale & daily specials sent to customers"
        centerValue={fmt(data.promosDownloadedTotal)}
        centerLabel="Promotions Downloaded"
        growth={data.growth?.promosDownloaded}
        segments={promoSegments}
        height={280}
      />
    </div>
  );
}

function Page3LiveChat({ data }: { data: any }) {
  const sessionsCompare = [
    { name: 'Sessions', total: data.totalsByType?.menu_viewed || 0, liveChat: data.liveChatSessionsTotal || 0 },
  ];
  const agentSegments = Object.entries(data.ticketsPerAgent || {}).map(([agent, count]: any, i) => ({
    label: `+${agent}`,
    value: count,
    color: SERIES[i % SERIES.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlimBarChart
        title="Live Chat Session Breakdown"
        subtitle="Total customer sessions vs. sessions escalated to a live agent"
        data={sessionsCompare}
        growth={data.growth?.liveChatSessions}
        bars={[
          { key: 'total', label: 'Total Sessions', color: C.grey500 },
          { key: 'liveChat', label: 'Total Live Chat Sessions', color: C.orange },
        ]}
        height={260}
      />
      <DoughnutCard
        title="Live Chats Completed Per Agent"
        centerValue={fmt(data.ticketsCompletedTotal)}
        centerLabel="Chats Completed"
        growth={data.growth?.ticketsCompleted}
        segments={agentSegments.length ? agentSegments : [{ label: 'No data', value: 1, color: C.grey200 }]}
        height={260}
      />
    </div>
  );
}

function Page4Billable({ data }: { data: any }) {
  const currency = data.billableSpendCurrency || 'ZAR';
  const breakdown = data.billableSpendBreakdown || {};
  const rows = Object.entries(breakdown).map(([key, v]: any) => ({
    key,
    label: PRICING_LABELS[key] || key,
    count: v.count,
    billableCount: v.billableCount,
    rate: v.rate,
    cost: v.cost,
  }));
  const nonBillable = Math.max(0, (data.messagesDelivered || 0) - (data.totalBillableMessages || 0));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <KpiCard icon={Wallet} label="Estimated spend on billable messages" value={fmtMoney(data.billableSpendTotal, currency)} growth={data.growth?.billableSpend} />
        <KpiCard label="Total billable messages" value={fmt(data.totalBillableMessages)} growth={data.growth?.totalBillableMessages} />
        <KpiCard label="Non-billable (free tier) messages" value={fmt(nonBillable)} />
      </div>

      {!data.billableRatesConfigured && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Conversation rates aren't configured yet, so spend shows as {fmtMoney(0, currency)}. Set WA_RATE_MARKETING /
          WA_RATE_UTILITY / WA_RATE_SERVICE / WA_RATE_AUTHENTICATION (and WA_RATE_CURRENCY) in the bot's environment to
          match your current Meta conversation-based price card, and this will populate automatically.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <SectionHeader title="Billable Spend By Category" subtitle={`Rate × billable count, in ${currency}`} />
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium text-slate-700">{r.label}</div>
                  <div className="text-xs text-slate-400">{fmt(r.billableCount)} billable of {fmt(r.count)} sent · rate {fmtMoney(r.rate, currency)}</div>
                </div>
                <div className="font-semibold text-slate-900">{fmtMoney(r.cost, currency)}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-sm text-slate-400 py-4">No billable message data for this period.</div>}
          </div>
        </div>
        <DoughnutCard
          title="Billable vs. Free-tier Messages"
          subtitle="Share of delivered messages that were billable"
          centerValue={fmt(data.totalBillableMessages)}
          centerLabel="Billable Messages"
          segments={[
            { label: 'Billable Messages', value: data.totalBillableMessages || 0, color: C.orange },
            { label: 'Free-tier / Service Messages', value: nonBillable, color: C.grey300 },
          ]}
          height={220}
        />
      </div>
    </div>
  );
}

// ─── Analytics tab ──────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [period, setPeriod] = useState<Period>('week');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const { from, to } = useMemo(() => rangeForPeriod(period, custom), [period, custom]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/whatsapp?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['date', 'events', 'unique_customers', 'messages_sent', 'messages_received'],
      ...data.dailySeries.map((d: any) => {
        const split = (data.dailyMessageTypeSeries || []).find((x: any) => x.date === d.date) || {};
        return [d.date, d.count, d.uniqueCustomers, split.sent || 0, split.received || 0];
      }),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!data || !exportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pageNodes = Array.from(exportRef.current.querySelectorAll<HTMLElement>('.pdf-page'));
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pageNodes.length; i++) {
        const canvas = await html2canvas(pageNodes[i], { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      }

      pdf.save(`whatsapp-report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast.error(e.message || 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['week', 'month', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              period === p ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            {p === 'week' ? 'Last 7 days' : p === 'month' ? 'This month' : 'Custom'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            />
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={exportPdf}
            disabled={!data || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-600 text-white text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" /> {exporting ? 'Building PDF…' : 'PDF report'}
          </button>
        </div>
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-rose-600 text-sm mb-4">{error}</div>}

      {data && (
        <>
          {/* ── KPI tiles ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard icon={MessageSquareText} label="Messages sent" value={fmt(data.messagesSent)} growth={data.growth?.messagesSent} />
            <KpiCard icon={MessageSquare} label="Messages received" value={fmt(data.messagesReceived)} growth={data.growth?.messagesReceived} />
            <KpiCard icon={CheckCheck} label="Messages delivered" value={fmt(data.messagesDelivered)} growth={data.growth?.messagesDelivered} />
            <KpiCard icon={Users} label="Unique customers" value={fmt(data.uniqueCustomers)} growth={data.growth?.uniqueCustomers} />
            <KpiCard icon={Headphones} label="Live chats closed"
              value={fmt((data.handoffsClosed?.orders?.count ?? 0) + (data.handoffsClosed?.support?.count ?? 0))}
              growth={data.growth?.ticketsCompleted} />
            <KpiCard icon={MousePointerClick} label="Engagements" value={fmt(data.uniqueEngagements)} growth={data.growth?.uniqueEngagements} />
            <KpiCard label="Currently in queue" value={fmt(data.currentlyQueued)} />
            <KpiCard label="Fallbacks (didn't understand)" value={fmt(data.totalsByType?.fallback_triggered ?? 0)} />
          </div>

          {/* ── Page 1: message volume + delivery + kind breakdown ──────── */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Messages</h2>
            <Page1Messages data={data} />
          </div>

          {/* ── Page 2: engagement + promo downloads ─────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Engagement</h2>
            <Page2Engagement data={data} />
          </div>

          {/* ── Page 3: live chat sessions + agents ──────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Live Chat</h2>
            <Page3LiveChat data={data} />
          </div>

          {/* ── Page 4: billable spend ────────────────────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Billable Messages &amp; Spend</h2>
            <Page4Billable data={data} />
          </div>

          {/* ── Off-screen print layout used only for PDF capture ───────── */}
          <PdfExportView ref={exportRef} data={data} period={period} />
        </>
      )}
    </div>
  );
}

// ─── Hidden multi-page landscape layout, captured page-by-page for the PDF ──

const PdfExportView = forwardRef<HTMLDivElement, { data: any; period: string }>(({ data, period }, ref) => {
  const currency = data.billableSpendCurrency || 'ZAR';
  return (
    <div ref={ref} style={{ position: 'fixed', top: -99999, left: -99999, width: 1400 }}>
      <PdfPage title={`WhatsApp Bot Report — ${period}`} subtitle="Overview & message volume">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <PdfKpi label="Messages sent" value={fmt(data.messagesSent)} growth={data.growth?.messagesSent} />
          <PdfKpi label="Messages received" value={fmt(data.messagesReceived)} growth={data.growth?.messagesReceived} />
          <PdfKpi label="Messages delivered" value={fmt(data.messagesDelivered)} growth={data.growth?.messagesDelivered} />
          <PdfKpi label="Unique customers" value={fmt(data.uniqueCustomers)} growth={data.growth?.uniqueCustomers} />
        </div>
        <Page1Messages data={data} />
      </PdfPage>

      <PdfPage title="Engagement & Promotions" subtitle="Where customers spend time, and what they download">
        <Page2Engagement data={data} />
      </PdfPage>

      <PdfPage title="Live Chat Performance" subtitle="Escalations and agent throughput">
        <Page3LiveChat data={data} />
      </PdfPage>

      <PdfPage title="Billable Messages & Spend" subtitle={`Estimated cost in ${currency}, by conversation category`}>
        <Page4Billable data={data} />
      </PdfPage>
    </div>
  );
});
PdfExportView.displayName = 'PdfExportView';

const PdfPage = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="pdf-page" style={{ width: 1400, height: 990, background: '#fff', padding: 40, boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20, borderBottom: `2px solid ${C.orange}`, paddingBottom: 12 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.grey900, margin: 0 }}>{title}</h2>
      {subtitle && <span style={{ fontSize: 13, color: C.grey500 }}>{subtitle}</span>}
    </div>
    {children}
  </div>
);

const PdfKpi = ({ label, value, growth }: { label: string; value: number | string; growth?: number | null }) => (
  <div style={{ border: `1px solid ${C.grey200}`, borderRadius: 10, padding: 14 }}>
    <div style={{ fontSize: 11, color: C.grey500 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.grey900, marginTop: 2 }}>{value}</div>
      {growth !== undefined && (
        <div style={{ fontSize: 11, fontWeight: 600, color: growth == null ? C.grey400 : growth > 0 ? C.orange : C.grey500 }}>
          {growth == null ? 'New' : `${growth > 0 ? '+' : ''}${growth}%`}
        </div>
      )}
    </div>
  </div>
);

// ─── Promo Files tab (unchanged behavior, moved from the old standalone page) ─

type PromoKey = 'retail_promo' | 'wholesale_promo' | 'daily_specials';

interface PromoDoc {
  key: PromoKey;
  fileUrl: string;
  filename: string;
  caption?: string;
  uploadedAt: string;
}

const SLOTS: { key: PromoKey; label: string; hint: string; defaultCaption: string }[] = [
  { key: 'retail_promo', label: 'Retail Promotion', hint: 'Sent when a customer selects Promotions → Retail Promotion', defaultCaption: 'Retail Promotion' },
  { key: 'wholesale_promo', label: 'Wholesale Promotion', hint: 'Sent when a customer selects Promotions → Wholesale Promotion', defaultCaption: 'Wholesale Promotion' },
  { key: 'daily_specials', label: 'Daily Specials', hint: 'Sent when a customer selects Daily Specials from the main menu', defaultCaption: 'Daily Specials' },
];

function PromoFilesTab() {
  const [docs, setDocs] = useState<Record<string, PromoDoc>>({});
  const [captions, setCaptions] = useState<Record<PromoKey, string>>({
    retail_promo: '', wholesale_promo: '', daily_specials: '',
  });
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<PromoKey | null>(null);

  useEffect(() => { fetchDocs(); }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/admin/promo-files');
      if (res.ok) {
        const data = await res.json();
        const byKey: Record<string, PromoDoc> = {};
        (data.documents || []).forEach((d: PromoDoc) => { byKey[d.key] = d; });
        setDocs(byKey);
        setCaptions((prev) => ({
          retail_promo: byKey.retail_promo?.caption ?? prev.retail_promo,
          wholesale_promo: byKey.wholesale_promo?.caption ?? prev.wholesale_promo,
          daily_specials: byKey.daily_specials?.caption ?? prev.daily_specials,
        }));
      } else {
        toast.error('Failed to load promo files');
      }
    } catch {
      toast.error('Failed to load promo files');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: PromoKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG, or WebP files are allowed');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB');
      return;
    }

    setUploadingKey(key);
    try {
      const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
      const fileUrl = await uploadToCloudinary(file, resourceType);

      const res = await fetch('/api/admin/promo-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, fileUrl, filename: file.name, caption: captions[key] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save file');
      }

      const data = await res.json();
      setDocs((prev) => ({ ...prev, [key]: data.document }));
      setCaptions((prev) => ({ ...prev, [key]: data.document.caption }));
      toast.success('File uploaded — the bot will send this immediately');
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploadingKey(null);
      e.target.value = '';
    }
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      {SLOTS.map((slot) => {
        const doc = docs[slot.key];
        const isUploading = uploadingKey === slot.key;
        return (
          <div key={slot.key} className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="font-medium">{slot.label}</h2>
              <p className="text-sm text-slate-500 mb-2">{slot.hint}</p>
              {doc ? (
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:underline">
                  <FileText className="w-4 h-4" /> {doc.filename} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-sm text-amber-600">No file uploaded yet — bot will send a fallback text message</span>
              )}
              <div className="mt-2">
                <label className="block text-xs text-slate-500 mb-1">Caption (shown under the file on WhatsApp)</label>
                <input
                  type="text"
                  value={captions[slot.key]}
                  onChange={(e) => setCaptions((prev) => ({ ...prev, [slot.key]: e.target.value }))}
                  placeholder={slot.defaultCaption}
                  className="w-full max-w-xs text-sm border border-slate-300 rounded-md px-2 py-1"
                />
              </div>
            </div>
            <label className="shrink-0 cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={isUploading} onChange={(e) => handleUpload(e, slot.key)} />
            </label>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

export default function WhatsAppAdminPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'files' ? 'files' : tabParam === 'messages' ? 'messages' : 'analytics';
  const [tab, setTab] = useState<'analytics' | 'files' | 'messages'>(initialTab);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1 text-slate-900">WhatsApp Bot</h1>
      <p className="text-slate-500 mb-6">
        Analytics for the customer-facing WhatsApp bot, the promo/specials files it sends, and the wording of its messages.
      </p>

      <div className="flex gap-1 border-b mb-6">
        {(['analytics', 'files', 'messages'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'analytics' ? 'Analytics' : t === 'files' ? 'Promo Files' : 'Bot Messages'}
          </button>
        ))}
      </div>

      {tab === 'analytics' ? <AnalyticsTab /> : tab === 'files' ? <PromoFilesTab /> : <BotMessagesTab />}
    </div>
  );
}

// ─── Bot Messages tab — edit the wording the bot sends, per branch ─────────

type MessageKey =
  | 'welcome_text'
  | 'main_menu_body'
  | 'promotions_menu_body'
  | 'location_text'
  | 'support_text'
  | 'specials_text'
  | 'retail_promo_fallback_text'
  | 'wholesale_promo_fallback_text'
  | 'order_text'
  | 'fallback_text';

interface BotMessageDoc {
  key: MessageKey;
  value: string;
  updatedAt: string;
}

const MESSAGE_SLOTS: { key: MessageKey; label: string; hint: string }[] = [
  { key: 'welcome_text', label: 'Welcome message', hint: 'Sent when a customer says "hi" or "menu"' },
  { key: 'main_menu_body', label: 'Main menu body', hint: 'The line shown above the main menu options' },
  { key: 'promotions_menu_body', label: 'Promotions menu body', hint: 'The line shown above the promotions options' },
  { key: 'location_text', label: 'Location message', hint: 'Sent when a customer selects Location — make sure this is the real address before going live' },
  { key: 'support_text', label: 'Support message', hint: 'Sent when a customer selects Customer support' },
  { key: 'specials_text', label: 'Daily specials fallback', hint: 'Sent if no daily specials file has been uploaded yet' },
  { key: 'retail_promo_fallback_text', label: 'Retail promotion fallback', hint: 'Sent if no retail promotion file has been uploaded yet' },
  { key: 'wholesale_promo_fallback_text', label: 'Wholesale promotion fallback', hint: 'Sent if no wholesale promotion file has been uploaded yet' },
  { key: 'order_text', label: 'Order message', hint: 'Sent when a customer selects Place an order' },
  { key: 'fallback_text', label: "Didn't-understand message", hint: "Sent when the bot doesn't recognize the customer's reply" },
];

function BotMessagesTab() {
  const [docs, setDocs] = useState<Record<string, BotMessageDoc>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<MessageKey | null>(null);

  useEffect(() => { fetchMessages(); }, []);

  const fetchMessages = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/bot-messages');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load bot messages');
        return;
      }
      const byKey: Record<string, BotMessageDoc> = {};
      (data.messages || []).forEach((d: BotMessageDoc) => { byKey[d.key] = d; });
      setDocs(byKey);
      setDrafts((prev) => {
        const next = { ...prev };
        MESSAGE_SLOTS.forEach((s) => { next[s.key] = byKey[s.key]?.value ?? ''; });
        return next;
      });
    } catch {
      setLoadError('Failed to load bot messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: MessageKey) => {
    const value = (drafts[key] || '').trim();
    if (!value) {
      toast.error("Message can't be empty");
      return;
    }
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/bot-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setDocs((prev) => ({ ...prev, [key]: data.message }));
      toast.success('Saved — the bot will use this within 30 seconds');
    } catch (error: any) {
      toast.error(error.message || 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (key: MessageKey) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/bot-messages?key=${key}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to reset');
      setDocs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setDrafts((prev) => ({ ...prev, [key]: '' }));
      toast.success('Reset to the default message');
    } catch (error: any) {
      toast.error(error.message || 'Reset failed');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;
  if (loadError) return <div className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-lg p-4">{loadError}</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      {MESSAGE_SLOTS.map((slot) => {
        const doc = docs[slot.key];
        const isSaving = savingKey === slot.key;
        const isDirty = (drafts[slot.key] || '') !== (doc?.value ?? '');
        return (
          <div key={slot.key} className="border border-slate-200 rounded-lg p-4">
            <h2 className="font-medium">{slot.label}</h2>
            <p className="text-sm text-slate-500 mb-2">{slot.hint}</p>
            {!doc && (
              <p className="text-xs text-amber-600 mb-2">Not customized yet — the bot is using its built-in default message.</p>
            )}
            <textarea
              value={drafts[slot.key] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [slot.key]: e.target.value }))}
              rows={3}
              placeholder="Enter the message the bot should send…"
              className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-400">
                {doc ? `Last updated ${new Date(doc.updatedAt).toLocaleString()}` : ''}
              </span>
              <div className="flex gap-2">
                {doc && (
                  <button
                    onClick={() => handleReset(slot.key)}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reset to default
                  </button>
                )}
                <button
                  onClick={() => handleSave(slot.key)}
                  disabled={isSaving || !isDirty}
                  className="px-3 py-1.5 rounded-md text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}