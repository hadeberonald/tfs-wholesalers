// app/[slug]/admin/whatsapp/_page.tsx
'use client';

import { useState, useEffect, useMemo, useRef, forwardRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FileText, Upload, ExternalLink, Download, FileDown,
  MessageSquare, MessageSquareText, CheckCheck, Users, Headphones, MousePointerClick,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

type Period = 'week' | 'month' | 'custom';

const COLORS = {
  indigo: '#4f46e5',
  indigoLight: '#818cf8',
  teal: '#0d9488',
  tealLight: '#5eead4',
  slate: '#475569',
  amber: '#d97706',
  rose: '#e11d48',
};
const PIE_COLORS = [COLORS.indigo, COLORS.teal, COLORS.amber, COLORS.rose, COLORS.slate, COLORS.indigoLight];

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

// Turn a { key: count } or { key: {count, ...} } map into a recharts-friendly array.
function objToArray(obj: Record<string, any> | undefined, opts?: { countKey?: string; labelMap?: Record<string, string> }) {
  if (!obj) return [];
  const countKey = opts?.countKey;
  return Object.entries(obj).map(([key, v]) => ({
    name: opts?.labelMap?.[key] || key.replace(/_/g, ' '),
    value: countKey ? (v?.[countKey] ?? 0) : (typeof v === 'number' ? v : v?.count ?? 0),
  }));
}

export default function WhatsAppAdminPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'files' ? 'files' : 'analytics';
  const [tab, setTab] = useState<'analytics' | 'files'>(initialTab);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1 text-slate-900">WhatsApp Bot</h1>
      <p className="text-slate-500 mb-6">
        Analytics for the customer-facing WhatsApp bot, and the promo/specials files it sends.
      </p>

      <div className="flex gap-1 border-b mb-6">
        {(['analytics', 'files'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'analytics' ? 'Analytics' : 'Promo Files'}
          </button>
        ))}
      </div>

      {tab === 'analytics' ? <AnalyticsTab /> : <PromoFilesTab />}
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
      ['date', 'events', 'unique_customers'],
      ...data.dailySeries.map((d: any) => [d.date, d.count, d.uniqueCustomers]),
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

  const messagesSentVsReceived = data ? [
    { name: 'Sent', value: data.messagesSent },
    { name: 'Received', value: data.messagesReceived },
  ] : [];
  const sentByType = objToArray(data?.messagesSentByType);
  const kindBreakdown = objToArray(data?.messageKindBreakdown);
  const statusBreakdown = objToArray(data?.messageStatusBreakdown);
  const pricing = objToArray(data?.pricingBreakdown, { countKey: 'count' });
  const engagements = objToArray(data?.pageEngagements)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const ticketsPerAgent = objToArray(data?.ticketsPerAgent);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['week', 'month', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 hover:bg-slate-50'
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-50"
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
            <KpiCard icon={MessageSquareText} label="Messages sent" value={data.messagesSent} />
            <KpiCard icon={MessageSquare} label="Messages received" value={data.messagesReceived} />
            <KpiCard icon={CheckCheck} label="Messages delivered" value={data.messagesDelivered} />
            <KpiCard icon={Users} label="Unique customers" value={data.uniqueCustomers} />
            <KpiCard icon={Headphones} label="Live chats closed"
              value={(data.handoffsClosed?.orders?.count ?? 0) + (data.handoffsClosed?.support?.count ?? 0)} />
            <KpiCard icon={MousePointerClick} label="Engagements" value={data.uniqueEngagements} />
            <KpiCard label="Currently in queue" value={data.currentlyQueued} />
            <KpiCard label="Fallbacks (didn't understand)" value={data.totalsByType?.fallback_triggered ?? 0} />
          </div>

          {/* ── Chart grid ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Messages sent vs. received">
              <BarChart data={messagesSentVsReceived}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Messages sent by type">
              <BarChart data={sentByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Chatbot vs. template messages">
              <PieChart>
                <Pie data={kindBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                  {kindBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ChartCard>

            <ChartCard title="Delivery status">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ChartCard>

            <ChartCard title="Pricing category (billable messages)">
              <BarChart data={pricing}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Top menu engagements">
              <BarChart data={engagements} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.slate} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Tickets closed per agent">
              <BarChart data={ticketsPerAgent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.indigoLight} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Busiest hours">
              <BarChart data={data.hourlyHistogram.map((h: any) => ({ name: h._id, value: h.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Activity over time</h3>
            <div className="h-64 border border-slate-200 rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Events" stroke={COLORS.indigo} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="uniqueCustomers" name="Unique customers" stroke={COLORS.teal} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Promo &amp; specials delivery</h3>
            <div className="border border-slate-200 rounded-lg divide-y">
              {Object.entries(data.promoBreakdown || {}).map(([key, v]: any) => (
                <div key={key} className="flex justify-between px-4 py-2 text-sm">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-slate-500">{v.sent} sent · {v.fallback} fallback</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Off-screen print layout used only for PDF capture ───────── */}
          <PdfExportView ref={exportRef} data={data} period={period} charts={{
            messagesSentVsReceived, sentByType, kindBreakdown, statusBreakdown,
            pricing, engagements, ticketsPerAgent,
          }} />
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon?: any; label: string; value: number | string; sub?: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5 text-indigo-500" />} {label}
      </div>
      <div className="text-2xl font-semibold mt-1 text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <h3 className="text-sm font-medium text-slate-700 mb-2">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Hidden multi-page landscape layout, captured page-by-page for the PDF ──

const PdfExportView = forwardRef<HTMLDivElement, { data: any; period: string; charts: any }>(({ data, period, charts }, ref) => (
  <div ref={ref} style={{ position: 'fixed', top: -99999, left: -99999, width: 1400 }}>
    <PdfPage title={`WhatsApp Bot Report — ${period}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <PdfKpi label="Messages sent" value={data.messagesSent} />
        <PdfKpi label="Messages received" value={data.messagesReceived} />
        <PdfKpi label="Messages delivered" value={data.messagesDelivered} />
        <PdfKpi label="Unique customers" value={data.uniqueCustomers} />
        <PdfKpi label="Live chats closed" value={(data.handoffsClosed?.orders?.count ?? 0) + (data.handoffsClosed?.support?.count ?? 0)} />
        <PdfKpi label="Engagements" value={data.uniqueEngagements} />
        <PdfKpi label="Currently in queue" value={data.currentlyQueued} />
        <PdfKpi label="Fallbacks" value={data.totalsByType?.fallback_triggered ?? 0} />
      </div>
    </PdfPage>

    <PdfPage title="Message volume">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 400 }}>
        <PdfChart><BarChart data={charts.messagesSentVsReceived}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Bar dataKey="value" fill={COLORS.indigo} /></BarChart></PdfChart>
        <PdfChart><BarChart data={charts.sentByType}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Bar dataKey="value" fill={COLORS.teal} /></BarChart></PdfChart>
      </div>
    </PdfPage>

    <PdfPage title="Message type &amp; delivery status">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 400 }}>
        <PdfChart><PieChart><Pie data={charts.kindBreakdown} dataKey="value" nameKey="name" outerRadius={110} label>{charts.kindBreakdown.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Legend /></PieChart></PdfChart>
        <PdfChart><PieChart><Pie data={charts.statusBreakdown} dataKey="value" nameKey="name" outerRadius={110} label>{charts.statusBreakdown.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Legend /></PieChart></PdfChart>
      </div>
    </PdfPage>

    <PdfPage title="Engagement &amp; agent performance">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 400 }}>
        <PdfChart><BarChart data={charts.engagements} layout="vertical" margin={{ left: 24 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={110} /><Bar dataKey="value" fill={COLORS.slate} /></BarChart></PdfChart>
        <PdfChart><BarChart data={charts.ticketsPerAgent}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Bar dataKey="value" fill={COLORS.indigoLight} /></BarChart></PdfChart>
      </div>
    </PdfPage>

    <PdfPage title="Activity trend &amp; busiest hours">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 400 }}>
        <PdfChart>
          <LineChart data={data.dailySeries}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis />
            <Line type="monotone" dataKey="count" stroke={COLORS.indigo} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="uniqueCustomers" stroke={COLORS.teal} strokeWidth={2} dot={false} />
          </LineChart>
        </PdfChart>
        <PdfChart><BarChart data={data.hourlyHistogram.map((h: any) => ({ name: h._id, value: h.count }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Bar dataKey="value" fill={COLORS.teal} /></BarChart></PdfChart>
      </div>
    </PdfPage>
  </div>
));
PdfExportView.displayName = 'PdfExportView';

const PdfPage = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="pdf-page" style={{ width: 1400, height: 990, background: '#fff', padding: 40, boxSizing: 'border-box' }}>
    <h2 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginBottom: 24 }}>{title}</h2>
    {children}
  </div>
);

const PdfKpi = ({ label, value }: { label: string; value: number | string }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>{value}</div>
  </div>
);

const PdfChart = ({ children }: { children: React.ReactElement }) => (
  <div style={{ height: 400 }}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
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
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
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