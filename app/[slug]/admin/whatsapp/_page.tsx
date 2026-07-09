// app/[slug]/admin/whatsapp/_page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FileText, Upload, ExternalLink, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

type Period = 'week' | 'month' | 'custom';

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

export default function WhatsAppAdminPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'files' ? 'files' : 'analytics';
  const [tab, setTab] = useState<'analytics' | 'files'>(initialTab);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">WhatsApp Bot</h1>
      <p className="text-gray-500 mb-6">
        Analytics for the customer-facing WhatsApp bot, and the promo/specials files it sends.
      </p>

      <div className="flex gap-1 border-b mb-6">
        {(['analytics', 'files'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['week', 'month', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              period === p ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
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
              className="border rounded-md px-2 py-1 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="border rounded-md px-2 py-1 text-sm"
            />
          </>
        )}
        <button
          onClick={exportCsv}
          disabled={!data}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Generate report (CSV)
        </button>
      </div>

      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Unique customers" value={data.uniqueCustomers} />
            <KpiCard label="Orders started" value={data.ordersStarted} />
            <KpiCard label="Orders closed" value={data.handoffsClosed?.orders?.count ?? 0}
              sub={data.handoffsClosed?.orders?.avgHandleMinutes != null ? `${data.handoffsClosed.orders.avgHandleMinutes}m avg` : undefined} />
            <KpiCard label="Support closed" value={data.handoffsClosed?.support?.count ?? 0}
              sub={data.handoffsClosed?.support?.avgHandleMinutes != null ? `${data.handoffsClosed.support.avgHandleMinutes}m avg` : undefined} />
            <KpiCard label="Menu views" value={data.totalsByType?.menu_viewed ?? 0} />
            <KpiCard label="Fallbacks (didn't understand)" value={data.totalsByType?.fallback_triggered ?? 0} />
            <KpiCard label="Currently in queue" value={data.currentlyQueued} />
            <KpiCard label="Agent messages sent" value={data.totalsByType?.agent_message ?? 0} />
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Activity over time</h3>
            <div className="h-64 border rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Events" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="uniqueCustomers" name="Unique customers" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Busiest hours</h3>
            <div className="h-56 border rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyHistogram.map((h: any) => ({ hour: h._id, count: h.count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Promo &amp; specials delivery</h3>
            <div className="border rounded-lg divide-y">
              {Object.entries(data.promoBreakdown || {}).map(([key, v]: any) => (
                <div key={key} className="flex justify-between px-4 py-2 text-sm">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500">{v.sent} sent · {v.fallback} fallback</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

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

  if (loading) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      {SLOTS.map((slot) => {
        const doc = docs[slot.key];
        const isUploading = uploadingKey === slot.key;
        return (
          <div key={slot.key} className="border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="font-medium">{slot.label}</h2>
              <p className="text-sm text-gray-500 mb-2">{slot.hint}</p>
              {doc ? (
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <FileText className="w-4 h-4" /> {doc.filename} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-sm text-amber-600">No file uploaded yet — bot will send a fallback text message</span>
              )}
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Caption (shown under the file on WhatsApp)</label>
                <input
                  type="text"
                  value={captions[slot.key]}
                  onChange={(e) => setCaptions((prev) => ({ ...prev, [slot.key]: e.target.value }))}
                  placeholder={slot.defaultCaption}
                  className="w-full max-w-xs text-sm border rounded-md px-2 py-1"
                />
              </div>
            </div>
            <label className="shrink-0 cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-gray-50">
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