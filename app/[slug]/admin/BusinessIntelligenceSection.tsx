// app/[slug]/admin/BusinessIntelligenceSection.tsx
//
// Cross-department analytics section for the admin dashboard home page.
// Visually matches the WhatsApp bot report (same orange+grey palette, same
// KpiCard/DoughnutCard/SlimBarChart primitives, same PDF export approach) so
// the two reports feel like one product.
//
// Render this ONLY for full-access admins / super-admins from the parent
// dashboard page, e.g.:
//
//   {(isSuperAdmin || can('analytics:read')) && <BusinessIntelligenceSection />}
//
// Requires the /api/admin/analytics/business route (business-analytics-route.ts)
// and the 'analytics' entry in lib/route-manifest.ts (adds 'analytics:read').

'use client';

import { useState, useEffect, useMemo, useRef, forwardRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Download, FileDown, DollarSign, ShoppingBag, Users, TrendingUp, TrendingDown,
  Minus, Sparkles, AlertTriangle, Truck, ClipboardCheck, Tag, Wallet, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Period = 'week' | 'month' | 'custom';

const C = {
  orange: '#f97316', orangeDark: '#c2410c', orangeLight: '#fdba74', orangeSoft: '#ffedd5',
  grey900: '#1e293b', grey700: '#475569', grey500: '#64748b', grey400: '#94a3b8',
  grey300: '#cbd5e1', grey200: '#e2e8f0', grey100: '#f1f5f9',
};
const SERIES = [C.orange, C.grey700, C.orangeLight, C.grey400, C.orangeDark, C.grey300];

function rangeForPeriod(period: Period, custom: { from: string; to: string }) {
  const now = new Date();
  if (period === 'week') return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: now.toISOString() };
  if (period === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString() };
  return {
    from: custom.from ? new Date(custom.from).toISOString() : new Date(now.getTime() - 7 * 86400000).toISOString(),
    to: custom.to ? new Date(custom.to).toISOString() : now.toISOString(),
  };
}

// Accepts anything (API responses are typed `any` throughout this file) and
// coerces safely to a display string — this is what the TS2345 fix hinges on:
// `fmt` no longer requires its caller to already have a `number`.
function fmt(n: unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (n == null || Number.isNaN(num)) return '0';
  return num.toLocaleString();
}
function fmtMoney(n: unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (n == null || Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(num);
}
/** Sums the values of a loosely-typed object (e.g. a status → count map from the API). */
function sumValues(obj: Record<string, unknown> | undefined | null): number {
  if (!obj) return 0;
  return Object.values(obj).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', picking: 'Picking', packaging: 'Packaging',
  collecting: 'Collecting', ready_for_delivery: 'Ready for Delivery', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', payment_pending: 'Payment Pending/Failed', payment_failed: 'Payment Pending/Failed',
};

// ─── Shared primitives (mirrors the WhatsApp report) ────────────────────────

function GrowthBadge({ value }: { value: number | null | undefined }) {
  if (value === undefined) return null;
  if (value === null) return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Sparkles className="w-3 h-3" /> New</span>;
  const flat = Math.abs(value) < 0.1;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${flat ? 'text-slate-400' : up ? 'text-orange-600' : 'text-slate-500'}`}>
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
          <span>{it.label}</span><span className="font-semibold text-slate-800">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DoughnutCard({ title, subtitle, segments, centerValue, centerLabel, height = 200, growth }: {
  title: string; subtitle?: string; segments: { label: string; value: number; color: string }[];
  centerValue: string | number; centerLabel: string; height?: number; growth?: number | null;
}) {
  const data = segments.map((s) => ({ name: s.label, value: s.value }));
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white h-full">
      <SectionHeader title={title} subtitle={subtitle} growth={growth} />
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
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

function SlimBarChart({ title, subtitle, data, bars, height = 220, growth, layout = 'vertical' }: {
  title: string; subtitle?: string; data: any[]; bars: { key: string; color: string; label: string }[];
  height?: number; growth?: number | null; layout?: 'vertical' | 'horizontal';
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
              {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[0, 6, 6, 0]} barSize={14} />)}
            </BarChart>
          ) : (
            <BarChart data={data} barCategoryGap="35%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grey200} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.grey500 }} axisLine={{ stroke: C.grey200 }} />
              <YAxis tick={{ fontSize: 11, fill: C.grey500 }} axisLine={{ stroke: C.grey200 }} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: C.grey100 }} />
              {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[6, 6, 0, 0]} barSize={16} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <Legend items={bars.map((b) => ({ label: b.label, color: b.color, value: data.reduce((sum, d) => sum + (Number(d[b.key]) || 0), 0) }))} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, growth }: { icon?: any; label: string; value: number | string; growth?: number | null }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">{Icon && <Icon className="w-3.5 h-3.5 text-orange-500" />} {label}</div>
      <div className="flex items-end justify-between mt-1">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
    </div>
  );
}

// ─── Department sections ─────────────────────────────────────────────────────

function OverviewSection({ data }: { data: any }) {
  const o = data.overview;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard icon={DollarSign} label="Revenue (paid orders)" value={fmtMoney(o.totalRevenue)} growth={o.revenueGrowth} />
      <KpiCard icon={ShoppingBag} label="Paid orders" value={fmt(o.totalOrders)} growth={o.ordersGrowth} />
      <KpiCard icon={Wallet} label="Avg order value" value={fmtMoney(o.avgOrderValue)} growth={o.aovGrowth} />
      <KpiCard icon={AlertTriangle} label="Failed/declined payments" value={`${fmt(o.failedPayments)} (${o.failedPaymentRate}%)`} />
      <KpiCard icon={Users} label="Active customers" value={fmt(o.totalCustomers)} growth={o.customerGrowth} />
      <KpiCard icon={UserCheck} label="New customers" value={fmt(o.newCustomers)} />
      <KpiCard label="All orders placed" value={fmt(o.totalOrdersAllStatuses)} />
    </div>
  );
}

function SalesSection({ data }: { data: any }) {
  const s = data.sales;
  const daily = (s.dailyRevenue || []).map((d: any) => ({ name: String(d.date).slice(5), revenue: d.revenue }));
  const statusData = Object.entries(s.orderStatusBreakdown || {}).map(([key, count]: [string, unknown], i) => ({
    label: STATUS_LABELS[key] || key, value: Number(count) || 0, color: SERIES[i % SERIES.length],
  }));
  const categoryRows = (s.topCategories || []).map((c: any) => ({ name: c.name, revenue: Math.round(c.revenue) }));
  const productRows = (s.topProducts || []).map((p: any) => ({ name: p.name || 'Unnamed', revenue: Math.round(p.revenue) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlimBarChart title="Daily Revenue" subtitle="Paid orders only" data={daily} bars={[{ key: 'revenue', label: 'Revenue (R)', color: C.orange }]} height={280} />
      <DoughnutCard title="Order Status Funnel" subtitle="All orders placed in this period" centerValue={fmt(data.overview.totalOrdersAllStatuses)} centerLabel="Total Orders" segments={statusData.length ? statusData : [{ label: 'No data', value: 1, color: C.grey200 }]} height={280} />
      <SlimBarChart title="Top Performing Categories" subtitle="By revenue" data={categoryRows} layout="horizontal" bars={[{ key: 'revenue', label: 'Revenue (R)', color: C.orangeDark }]} height={Math.max(200, categoryRows.length * 32)} />
      <SlimBarChart title="Top Selling Products" subtitle="By revenue" data={productRows} layout="horizontal" bars={[{ key: 'revenue', label: 'Revenue (R)', color: C.grey500 }]} height={Math.max(200, productRows.length * 32)} />
    </div>
  );
}

function BuyingSection({ data }: { data: any }) {
  const b = data.buying;
  const statusSegments = Object.entries(b.poStatusBreakdown || {}).map(([key, count]: [string, unknown], i) => ({
    label: key.replace(/_/g, ' '), value: Number(count) || 0, color: SERIES[i % SERIES.length],
  }));
  const supplierRows = (b.topSuppliers || []).map((s: any) => ({ name: s._id || 'Unknown', total: Math.round(s.total) }));
  const poTotal = sumValues(b.poStatusBreakdown);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard icon={Wallet} label="Total PO value" value={fmtMoney(b.totalPOValue)} growth={b.poValueGrowth} />
        <KpiCard icon={ClipboardCheck} label="Awaiting approval" value={fmt(b.pendingApproval)} />
        <KpiCard label="Avg days to receive" value={b.avgDaysToReceive != null ? `${b.avgDaysToReceive}d` : '—'} />
        <KpiCard label="Receiving issue rate" value={`${b.receivingIssueRate}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DoughnutCard title="Purchase Order Pipeline" centerValue={fmt(poTotal)} centerLabel="Purchase Orders" segments={statusSegments.length ? statusSegments : [{ label: 'No data', value: 1, color: C.grey200 }]} height={260} />
        <SlimBarChart title="Top Suppliers" subtitle="By spend this period" data={supplierRows} layout="horizontal" bars={[{ key: 'total', label: 'Spend (R)', color: C.orange }]} height={Math.max(200, supplierRows.length * 32)} />
      </div>
    </div>
  );
}

function FulfillmentSection({ data }: { data: any }) {
  const f = data.fulfillment;
  const oosRows = (f.topOOSProducts || []).map((p: any) => ({ name: p.name || 'Unnamed', count: p.count }));
  const resolutionSegments = Object.entries(f.resolutions?.byType || {}).map(([key, count]: [string, unknown], i) => ({
    label: key, value: Number(count) || 0, color: SERIES[i % SERIES.length],
  }));
  const pickerRows = (f.pickerLeaderboard || []).map((p: any) => ({ name: p.name, items: p.items }));
  const driverRows = (f.driverLeaderboard || []).map((d: any) => ({ name: d.name, deliveries: d.deliveries }));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard icon={AlertTriangle} label="Low stock products" value={fmt(f.lowStockCount)} />
        <KpiCard icon={ClipboardCheck} label="Overdue stock takes" value={fmt(f.overdueStockTakes)} />
        <KpiCard label="Stock variance (units)" value={fmt(f.stockVarianceTotal)} />
        <KpiCard icon={Truck} label="Avg fulfillment time" value={f.avgFulfillmentHours != null ? `${f.avgFulfillmentHours}h` : '—'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SlimBarChart title="Most Frequently Out-of-Stock" data={oosRows} layout="horizontal" bars={[{ key: 'count', label: 'Times marked OOS', color: C.orangeDark }]} height={Math.max(200, oosRows.length * 32)} />
        <DoughnutCard title="Order Resolutions by Type" subtitle={`${f.resolutions?.open ?? 0} open · ${f.resolutions?.highPriority ?? 0} high priority`} centerValue={fmt(f.resolutions?.open)} centerLabel="Open Resolutions" segments={resolutionSegments.length ? resolutionSegments : [{ label: 'No data', value: 1, color: C.grey200 }]} height={240} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SlimBarChart title="Picker Leaderboard" subtitle="Items picked this period" data={pickerRows} layout="horizontal" bars={[{ key: 'items', label: 'Items picked', color: C.orange }]} height={Math.max(180, pickerRows.length * 32)} />
        <SlimBarChart title="Driver Leaderboard" subtitle="Deliveries completed this period" data={driverRows} layout="horizontal" bars={[{ key: 'deliveries', label: 'Deliveries', color: C.grey700 }]} height={Math.max(180, driverRows.length * 32)} />
      </div>
    </div>
  );
}

function MarketingSection({ data }: { data: any }) {
  const m = data.marketing;
  const promoRows = (m.topPromoCodes || []).map((p: any) => ({ name: p.code, uses: p.uses }));
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard icon={Tag} label="Active specials" value={`${m.specials.active}/${m.specials.total}`} />
        <KpiCard icon={Tag} label="Active combos" value={`${m.combos.active}/${m.combos.total}`} />
        <KpiCard label="Promo code redemptions" value={fmt(m.promoRedemptions)} />
        <KpiCard label="Promo codes live" value={fmt(m.promoCodeCount)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SlimBarChart title="Top Promo Codes" subtitle="By redemptions" data={promoRows} layout="horizontal" bars={[{ key: 'uses', label: 'Uses', color: C.orange }]} height={Math.max(160, promoRows.length * 32)} />
        <DoughnutCard title="In-Store NPS" centerValue={m.npsInStore.score} centerLabel={`${m.npsInStore.total} responses`} growth={m.npsInStore.trend} segments={[{ label: 'Score', value: Math.max(m.npsInStore.score, 0), color: C.orange }, { label: 'Remaining', value: Math.max(100 - m.npsInStore.score, 0), color: C.grey200 }]} height={200} />
        <DoughnutCard title="Delivery NPS" centerValue={m.npsDelivery.score} centerLabel={`${m.npsDelivery.total} responses`} growth={m.npsDelivery.trend} segments={[{ label: 'Score', value: Math.max(m.npsDelivery.score, 0), color: C.orangeDark }, { label: 'Remaining', value: Math.max(100 - m.npsDelivery.score, 0), color: C.grey200 }]} height={200} />
      </div>
    </div>
  );
}

function PeopleSection({ data }: { data: any }) {
  const p = data.people;
  const roleRows = Object.entries(p.staffByRole || {}).map(([key, count]: [string, unknown]) => ({ name: key, count: Number(count) || 0 }));
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard icon={Users} label="Total staff" value={fmt(p.totalStaff)} />
        <KpiCard icon={UserCheck} label="New customers" value={fmt(p.newCustomers)} />
        <KpiCard label="Till-linked customers" value={fmt(p.tillLinkedCustomers)} />
      </div>
      <SlimBarChart title="Staff by Role" data={roleRows} bars={[{ key: 'count', label: 'Staff', color: C.orange }]} height={220} />
    </div>
  );
}

// ─── Main section (period selector, fetch, export) ───────────────────────────

export default function BusinessIntelligenceSection() {
  const [period, setPeriod] = useState<Period>('month');
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
    fetch(`/api/admin/analytics/business?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  const exportPdf = async () => {
    if (!data || !exportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pageNodes = Array.from(exportRef.current.querySelectorAll<HTMLElement>('.pdf-page'));
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageNodes.length; i++) {
        const canvas = await html2canvas(pageNodes[i], { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio, h = canvas.height * ratio;
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      }
      pdf.save(`business-report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast.error(e.message || 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['metric', 'value'],
      ['Revenue', data.overview.totalRevenue],
      ['Paid Orders', data.overview.totalOrders],
      ['Avg Order Value', data.overview.avgOrderValue],
      ['Failed Payments', data.overview.failedPayments],
      ['Total PO Value', data.buying.totalPOValue],
      ['Low Stock Products', data.fulfillment.lowStockCount],
      ['NPS In-Store', data.marketing.npsInStore.score],
      ['NPS Delivery', data.marketing.npsDelivery.score],
      ['Total Staff', data.people.totalStaff],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="business-intelligence" className="bg-white rounded-2xl p-6 shadow-sm mb-8 scroll-mt-32">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Business Intelligence</h2>
          <p className="text-slate-500 text-sm">Cross-department view — sales, buying, fulfillment, marketing &amp; people</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 my-4">
        {(['week', 'month', 'custom'] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-md text-sm border ${period === p ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-300 hover:bg-slate-50'}`}>
            {p === 'week' ? 'Last 7 days' : p === 'month' ? 'This month' : 'Custom'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="border border-slate-300 rounded-md px-2 py-1 text-sm" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="border border-slate-300 rounded-md px-2 py-1 text-sm" />
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={exportPdf} disabled={!data || exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-600 text-white text-sm hover:bg-orange-700 disabled:opacity-50"><FileDown className="w-4 h-4" /> {exporting ? 'Building PDF…' : 'PDF report'}</button>
        </div>
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-rose-600 text-sm mb-4">{error}</div>}

      {data && (
        <>
          <div className="mb-8"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Overview</h3><OverviewSection data={data} /></div>
          <div className="mb-8"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Sales</h3><SalesSection data={data} /></div>
          <div className="mb-8"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Buying &amp; Procurement</h3><BuyingSection data={data} /></div>
          <div className="mb-8"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Inventory &amp; Fulfillment</h3><FulfillmentSection data={data} /></div>
          <div className="mb-8"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">Marketing &amp; Customer Experience</h3><MarketingSection data={data} /></div>
          <div className="mb-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">People</h3><PeopleSection data={data} /></div>

          <PdfExportView ref={exportRef} data={data} period={period} />
        </>
      )}
    </div>
  );
}

// ─── Hidden landscape pages captured for PDF export ──────────────────────────

const PdfExportView = forwardRef<HTMLDivElement, { data: any; period: string }>(({ data, period }, ref) => (
  <div ref={ref} style={{ position: 'fixed', top: -99999, left: -99999, width: 1400 }}>
    <PdfPage title={`Business Report — ${period}`} subtitle="Overview"><OverviewSection data={data} /></PdfPage>
    <PdfPage title="Sales" subtitle="Revenue, order funnel, top categories & products"><SalesSection data={data} /></PdfPage>
    <PdfPage title="Buying & Procurement" subtitle="Purchase orders, suppliers, receiving"><BuyingSection data={data} /></PdfPage>
    <PdfPage title="Inventory & Fulfillment" subtitle="Stock, OOS, resolutions, picker/driver performance"><FulfillmentSection data={data} /></PdfPage>
    <PdfPage title="Marketing & Customer Experience" subtitle="Specials, combos, promo codes, NPS"><MarketingSection data={data} /></PdfPage>
    <PdfPage title="People" subtitle="Staff & customer base"><PeopleSection data={data} /></PdfPage>
  </div>
));
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