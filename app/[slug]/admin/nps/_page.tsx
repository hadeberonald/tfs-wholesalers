'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Users, MessageSquare, Star,
  ThumbsUp, ThumbsDown, Minus, Calendar, ChevronDown,
  Download, Store, UserCheck, ShoppingCart, Lightbulb,
  BarChart2, ArrowLeft,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionStats {
  overall:  Record<string, Record<string, number>>;
  store:    Record<string, Record<string, number>>;
  staff:    Record<string, Record<string, number>>;
  products: Record<string, Record<string, number>>;
}

interface NPSResponse {
  _id: string;
  score: number | null;
  type: string | null;
  submittedAt: string;
  overall?: { satisfaction?: string; recommendLikelihood?: string; metExpectations?: string; oneImprovement?: string; threeWords?: string };
  store?:   { easyToFind?: string; cleanliness?: string; checkoutWait?: string };
  staff?:   { greeted?: string; friendliness?: string; madeRecommendation?: string; recommendationDetails?: string };
  products?:{ foundAllItems?: string; quality?: string; promotionsDriven?: string; newProductSuggestions?: string };
  contact?: { name?: string; phone?: string; email?: string } | null;
}

interface NPSStats {
  totalResponses: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  averageScore: number;
  scoreDistribution: { score: number; count: number }[];
  trend: number;
  sectionStats: SectionStats;
  improvements: string[];
  productSuggestions: string[];
  threeWords: string[];
  recentResponses: NPSResponse[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: 'Today',        value: '1'   },
  { label: 'Last 7 days',  value: '7'   },
  { label: 'Last 30 days', value: '30'  },
  { label: 'Last 90 days', value: '90'  },
  { label: 'All time',     value: 'all' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function topEntry(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (!entries.length) return '—';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const p = pct(count, total);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">{count} ({p}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children }: {
  title: string; icon: any; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-5">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MetricGroup({ label, data, total, color = 'bg-brand-orange' }: {
  label: string; data: Record<string, number>; total: number; color?: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      {entries.map(([key, count]) => (
        <BarRow key={key} label={key} count={count} total={total} color={color} />
      ))}
    </div>
  );
}

// ─── PDF Print styles ─────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #nps-pdf-report, #nps-pdf-report * { visibility: visible; }
  #nps-pdf-report { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { margin: 15mm; size: A4; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────

export default function NPSResultsPage() {
  const params = useParams();
  const slug   = params?.slug as string;

  const [stats, setStats]   = useState<NPSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'responses'>('overview');
  const [respFilter, setRespFilter] = useState<'all' | 'promoter' | 'passive' | 'detractor'>('all');

  useEffect(() => { fetchStats(); }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nps/stats?branchSlug=${slug}&period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch NPS stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  const getScoreBadge = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 9) return 'bg-green-100 text-green-700';
    if (score >= 7) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 pt-32 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
    </div>
  );

  if (!stats) return (
    <div className="min-h-screen bg-gray-50 pt-32 flex items-center justify-center">
      <p className="text-gray-500">No survey data found for this period.</p>
    </div>
  );

  const n   = stats.totalResponses;
  const bg  = stats.npsScore >= 50 ? 'from-green-500 to-emerald-600' : stats.npsScore >= 0 ? 'from-yellow-400 to-orange-500' : 'from-red-500 to-rose-600';
  const ss  = stats.sectionStats;
  const maxBar = Math.max(...stats.scoreDistribution.map(d => d.count), 1);

  const filteredResponses = stats.recentResponses.filter(r =>
    respFilter === 'all' ? true : r.type === respFilter
  );

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28" id="nps-pdf-report">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print">
            <div>
              <Link href={`/${slug}/admin`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">Customer Feedback</h1>
              <p className="text-gray-500">In-store survey results & analytics</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Period */}
              <div className="relative inline-flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-orange shadow-sm"
                >
                  {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {/* PDF */}
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-brand-orange" />
                Export PDF
              </button>
            </div>
          </div>

          {/* PDF print header (only visible on print) */}
          <div className="hidden print:block mb-8 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Daily NPS & Customer Feedback Report</h1>
                <p className="text-gray-500 text-sm">{today} · {PERIOD_OPTIONS.find(o => o.value === period)?.label}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-3xl text-gray-900">{stats.npsScore > 0 ? '+' : ''}{stats.npsScore}</p>
                <p className="text-xs text-gray-500">NPS Score</p>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100 mb-8 no-print w-fit">
            {(['overview', 'sections', 'responses'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                  activeTab === t ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ════════════════════ OVERVIEW TAB ════════════════════ */}
          {(activeTab === 'overview' || typeof window === 'undefined') && (
            <div>
              {/* Top stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className={`col-span-2 lg:col-span-1 bg-gradient-to-br ${bg} rounded-2xl p-6 text-white shadow-lg`}>
                  <p className="text-white/80 text-sm font-medium mb-1">NPS Score</p>
                  <p className="text-6xl font-black leading-none mb-2">{stats.npsScore > 0 ? '+' : ''}{stats.npsScore}</p>
                  <div className="flex items-center gap-1 text-white/80 text-sm">
                    {stats.trend > 0 ? <TrendingUp className="w-4 h-4" /> : stats.trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    <span>{stats.trend > 0 ? '+' : ''}{stats.trend} vs prev period</span>
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    {stats.npsScore >= 70 ? '🏆 World class' : stats.npsScore >= 50 ? '✅ Excellent' : stats.npsScore >= 0 ? '👍 Good' : '⚠️ Needs attention'}
                  </p>
                </div>
                {[
                  { label: 'Responses', value: stats.totalResponses, sub: 'total collected', icon: <Users className="w-4 h-4 text-gray-600" />, bg: 'bg-gray-100' },
                  { label: 'Avg Score', value: stats.averageScore.toFixed(1), sub: 'out of 10', icon: <Star className="w-4 h-4 text-yellow-600" />, bg: 'bg-yellow-100' },
                  { label: 'Comments', value: stats.improvements.length + stats.productSuggestions.length, sub: 'written entries', icon: <MessageSquare className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-100' },
                ].map(({ label, value, sub, icon, bg: ibg }) => (
                  <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-2 ${ibg} rounded-lg`}>{icon}</div>
                      <p className="text-sm text-gray-500 font-medium">{label}</p>
                    </div>
                    <p className="text-4xl font-black text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400 mt-1">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Promoter breakdown + score distribution */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-5">Likelihood to Recommend</h2>
                  <div className="space-y-4">
                    {[
                      { label: 'Promoters',   sub: 'Extremely / Very Likely', count: stats.promoters,  color: 'bg-green-500', li: 'bg-green-50',  tx: 'text-green-700',  icon: <ThumbsUp className="w-4 h-4" /> },
                      { label: 'Passives',    sub: 'Likely',                  count: stats.passives,   color: 'bg-yellow-400',li: 'bg-yellow-50', tx: 'text-yellow-700', icon: <Minus className="w-4 h-4" /> },
                      { label: 'Detractors', sub: 'Unlikely / Very Unlikely', count: stats.detractors, color: 'bg-red-500',   li: 'bg-red-50',    tx: 'text-red-700',    icon: <ThumbsDown className="w-4 h-4" /> },
                    ].map(({ label, sub, count, color, li, tx, icon }) => {
                      const p = pct(count, n);
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${li} ${tx}`}>{icon}</div>
                              <div>
                                <span className="text-sm font-semibold text-gray-800">{label}</span>
                                <span className="text-xs text-gray-400 ml-2">{sub}</span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-gray-800">{count} ({p}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-2.5 rounded-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Score distribution */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-5">Score Distribution</h2>
                  <div className="flex items-end justify-between gap-1 h-36">
                    {Array.from({ length: 11 }, (_, i) => {
                      const count  = stats.scoreDistribution.find(d => d.score === i)?.count ?? 0;
                      const height = count > 0 ? Math.max((count / maxBar) * 100, 6) : 0;
                      const col    = i <= 6 ? 'bg-red-400' : i <= 8 ? 'bg-yellow-400' : 'bg-green-500';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-400">{count > 0 ? count : ''}</span>
                          <div className={`w-full rounded-t-md ${col}`} style={{ height: `${height}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs font-medium text-gray-500">{i}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Snapshot cards for each section */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Top Satisfaction',  value: topEntry(ss.overall.satisfaction || {}),       icon: Star,        color: 'text-yellow-500', bg: 'bg-yellow-50'  },
                  { label: 'Store Cleanliness', value: topEntry(ss.store.cleanliness    || {}),       icon: Store,       color: 'text-blue-500',   bg: 'bg-blue-50'    },
                  { label: 'Staff Friendliness',value: topEntry(ss.staff.friendliness   || {}),       icon: UserCheck,   color: 'text-purple-500', bg: 'bg-purple-50'  },
                  { label: 'Product Quality',   value: topEntry(ss.products.quality     || {}),       icon: ShoppingCart,color: 'text-green-500',  bg: 'bg-green-50'   },
                ].map(({ label, value, icon: Icon, color, bg: ibg }) => (
                  <div key={label} className={`rounded-2xl p-5 ${ibg} border border-gray-100`}>
                    <Icon className={`w-5 h-5 ${color} mb-2`} />
                    <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                    <p className="text-base font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Three-words cloud */}
              {stats.threeWords.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">How customers described their experience</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.threeWords.map((w, i) => (
                      <span key={i} className="bg-orange-50 text-brand-orange border border-orange-100 rounded-full px-3 py-1 text-sm font-medium">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement suggestions */}
              {stats.improvements.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-bold text-gray-900">Suggested Improvements</h2>
                  </div>
                  <div className="space-y-2">
                    {stats.improvements.slice(0, 10).map((text, i) => (
                      <div key={i} className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2.5">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        <p className="text-sm text-gray-700">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product suggestions */}
              {stats.productSuggestions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-bold text-gray-900">New Product Requests</h2>
                  </div>
                  <div className="space-y-2">
                    {stats.productSuggestions.slice(0, 10).map((text, i) => (
                      <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                        <span className="text-green-500 mt-0.5">•</span>
                        <p className="text-sm text-gray-700">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ SECTIONS TAB ════════════════════ */}
          {activeTab === 'sections' && (
            <div className="grid lg:grid-cols-2 gap-6">

              <SectionCard title="Overall Satisfaction" icon={Star} iconColor="text-yellow-500">
                <MetricGroup label="Overall Satisfaction" data={ss.overall.satisfaction || {}} total={n} color="bg-yellow-400" />
                <MetricGroup label="Likelihood to Recommend" data={ss.overall.recommendLikelihood || {}} total={n} color="bg-orange-400" />
                <MetricGroup label="Met Expectations?" data={ss.overall.metExpectations || {}} total={n} color="bg-amber-400" />
              </SectionCard>

              <SectionCard title="Store Experience & Environment" icon={Store} iconColor="text-blue-500">
                <MetricGroup label="Ease of Finding Items" data={ss.store.easyToFind || {}} total={n} color="bg-blue-400" />
                <MetricGroup label="Store Cleanliness" data={ss.store.cleanliness || {}} total={n} color="bg-blue-500" />
                <MetricGroup label="Checkout Wait Times" data={ss.store.checkoutWait || {}} total={n} color="bg-sky-400" />
              </SectionCard>

              <SectionCard title="Staff Performance & Service" icon={UserCheck} iconColor="text-purple-500">
                <MetricGroup label="Greeted by Staff" data={ss.staff.greeted || {}} total={n} color="bg-purple-400" />
                <MetricGroup label="Staff Friendliness & Knowledge" data={ss.staff.friendliness || {}} total={n} color="bg-purple-500" />
                <MetricGroup label="Staff Made a Recommendation" data={ss.staff.madeRecommendation || {}} total={n} color="bg-violet-400" />
              </SectionCard>

              <SectionCard title="Products & Purchase Feedback" icon={ShoppingCart} iconColor="text-green-500">
                <MetricGroup label="Found All Items" data={ss.products.foundAllItems || {}} total={n} color="bg-green-400" />
                <MetricGroup label="Product Quality Rating" data={ss.products.quality || {}} total={n} color="bg-emerald-500" />
                <MetricGroup label="Drawn in by Promotions?" data={ss.products.promotionsDriven || {}} total={n} color="bg-teal-400" />
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ RESPONSES TAB ════════════════════ */}
          {activeTab === 'responses' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Individual Responses ({filteredResponses.length})</h2>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'promoter', 'passive', 'detractor'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setRespFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          respFilter === f ? 'bg-brand-orange text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {filteredResponses.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">No responses match this filter.</div>
                ) : filteredResponses.map(r => (
                  <div key={r._id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${getScoreBadge(r.score)}`}>
                          {r.score ?? '—'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.overall?.satisfaction || 'No rating'}</p>
                          {r.contact?.name && <p className="text-xs text-gray-500">{r.contact.name} · {r.contact.phone}</p>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.submittedAt)}</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {r.overall?.recommendLikelihood   && <span className="bg-orange-50 text-orange-700 rounded-lg px-2 py-1"><b>Recommend:</b> {r.overall.recommendLikelihood}</span>}
                      {r.overall?.metExpectations       && <span className="bg-blue-50 text-blue-700 rounded-lg px-2 py-1"><b>Expectations:</b> {r.overall.metExpectations}</span>}
                      {r.store?.easyToFind              && <span className="bg-sky-50 text-sky-700 rounded-lg px-2 py-1"><b>Navigation:</b> {r.store.easyToFind}</span>}
                      {r.store?.cleanliness             && <span className="bg-teal-50 text-teal-700 rounded-lg px-2 py-1"><b>Cleanliness:</b> {r.store.cleanliness}</span>}
                      {r.store?.checkoutWait            && <span className="bg-cyan-50 text-cyan-700 rounded-lg px-2 py-1"><b>Checkout:</b> {r.store.checkoutWait}</span>}
                      {r.staff?.greeted                 && <span className="bg-purple-50 text-purple-700 rounded-lg px-2 py-1"><b>Greeted:</b> {r.staff.greeted}</span>}
                      {r.staff?.friendliness            && <span className="bg-violet-50 text-violet-700 rounded-lg px-2 py-1"><b>Staff:</b> {r.staff.friendliness}</span>}
                      {r.products?.foundAllItems        && <span className="bg-green-50 text-green-700 rounded-lg px-2 py-1"><b>Found items:</b> {r.products.foundAllItems}</span>}
                      {r.products?.quality              && <span className="bg-emerald-50 text-emerald-700 rounded-lg px-2 py-1"><b>Quality:</b> {r.products.quality}</span>}
                      {r.products?.promotionsDriven     && <span className="bg-lime-50 text-lime-700 rounded-lg px-2 py-1"><b>Promo visit:</b> {r.products.promotionsDriven}</span>}
                    </div>

                    {(r.overall?.oneImprovement || r.overall?.threeWords || r.products?.newProductSuggestions) && (
                      <div className="mt-3 space-y-1.5">
                        {r.overall?.threeWords              && <p className="text-xs text-gray-600 italic">Words: "{r.overall.threeWords}"</p>}
                        {r.overall?.oneImprovement          && <p className="text-xs text-gray-600">💡 {r.overall.oneImprovement}</p>}
                        {r.products?.newProductSuggestions  && <p className="text-xs text-gray-600">🛒 {r.products.newProductSuggestions}</p>}
                        {r.staff?.recommendationDetails     && <p className="text-xs text-gray-600">👋 Rec: {r.staff.recommendationDetails}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}