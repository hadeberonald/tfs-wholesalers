'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Users, MessageSquare, Star,
  ThumbsUp, ThumbsDown, Minus, Calendar, ChevronDown,
  Download, Store, UserCheck, ShoppingCart, Lightbulb,
  ArrowLeft, Truck, Package, CheckCircle, XCircle,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  staff?:   { greeted?: string; friendliness?: string; madeRecommendation?: string };
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

// ─── Delivery types ────────────────────────────────────────────────────────────

interface DeliveryStats {
  totalResponses:   number;
  npsScore:         number;
  promoters:        number;
  passives:         number;
  detractors:       number;
  averageScore:     number;
  averageRatings: {
    deliverySpeed:       number;
    driverFriendliness:  number;
    packagingQuality:    number;
    overallSatisfaction: number;
  };
  scoreDistribution: { score: number; count: number }[];
  trend: number;
  sectionStats: {
    delivery: {
      speed:              Record<string, number>;
      driverFriendliness: Record<string, number>;
      packagingQuality:   Record<string, number>;
      itemsReceived:      Record<string, number>;
      itemCondition:      Record<string, number>;
    };
    overall: {
      satisfaction: Record<string, number>;
      wouldReorder: Record<string, number>;
    };
  };
  comments:         string[];
  recentResponses:  any[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: 'Today',        value: '1'   },
  { label: 'Last 7 days',  value: '7'   },
  { label: 'Last 30 days', value: '30'  },
  { label: 'Last 90 days', value: '90'  },
  { label: 'All time',     value: 'all' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function StarBar({ value }: { value: number }) {
  const p = (value / 5) * 100;
  const color = value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-2.5 rounded-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-8 text-right">{value.toFixed(1)}</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <Star key={n} className={`w-3 h-3 ${n <= Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
        ))}
      </div>
    </div>
  );
}

// ─── PDF Print styles ──────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #nps-pdf-report, #nps-pdf-report * { visibility: visible; }
  #nps-pdf-report { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { margin: 15mm; size: A4; }
}
`;

// ─── Main component ────────────────────────────────────────────────────────────

export default function NPSResultsPage() {
  const params = useParams();
  const slug   = params?.slug as string;

  const [stats, setStats]           = useState<NPSStats | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('30');
  const [activeTab, setActiveTab]   = useState<'overview' | 'sections' | 'delivery' | 'responses'>('overview');
  const [respFilter, setRespFilter] = useState<'all' | 'promoter' | 'passive' | 'detractor'>('all');

  useEffect(() => { fetchAllStats(); }, [period]);

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      const [inStoreRes, deliveryRes] = await Promise.all([
        fetch(`/api/nps/stats?branchSlug=${slug}&period=${period}`),
        fetch(`/api/nps/delivery/stats?branchSlug=${slug}&period=${period}`),
      ]);
      if (inStoreRes.ok) {
        const data = await inStoreRes.json();
        setStats(data.stats);
      }
      if (deliveryRes.ok) {
        const data = await deliveryRes.json();
        setDeliveryStats(data.stats);
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
    if (score >= 4) return 'bg-green-100 text-green-700';
    if (score >= 3) return 'bg-yellow-100 text-yellow-700';
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

  const n      = stats.totalResponses;
  const dn     = deliveryStats?.totalResponses ?? 0;
  const bg     = stats.npsScore >= 50 ? 'from-green-500 to-emerald-600' : stats.npsScore >= 0 ? 'from-yellow-400 to-orange-500' : 'from-red-500 to-rose-600';
  const dbg    = !deliveryStats ? 'from-gray-300 to-gray-400' : deliveryStats.npsScore >= 50 ? 'from-green-500 to-emerald-600' : deliveryStats.npsScore >= 0 ? 'from-yellow-400 to-orange-500' : 'from-red-500 to-rose-600';
  const ss     = stats.sectionStats;
  const maxBar = Math.max(...stats.scoreDistribution.map(d => d.count), 1);
  const dmaxBar = deliveryStats ? Math.max(...deliveryStats.scoreDistribution.map(d => d.count), 1) : 1;

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const filteredResponses = stats.recentResponses.filter(r =>
    respFilter === 'all' ? true : r.type === respFilter
  );

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
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">TFS Vryheid — Customer Satisfaction</h1>
              <p className="text-gray-500">In-store & delivery survey results</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
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
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-brand-orange" />
                Export PDF
              </button>
            </div>
          </div>

          {/* PDF print header */}
          <div className="hidden print:block mb-8 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-gray-900">TFS Vryheid — Daily Customer Satisfaction Report</h1>
                <p className="text-gray-500 text-sm italic">We Put U First! &nbsp;·&nbsp; {today} · {PERIOD_OPTIONS.find(o => o.value === period)?.label}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-3xl text-gray-900">{stats.npsScore > 0 ? '+' : ''}{stats.npsScore}</p>
                <p className="text-xs text-gray-500">In-Store NPS</p>
              </div>
            </div>
          </div>

          {/* ── Tabs — now includes Delivery ── */}
          <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100 mb-8 no-print w-fit">
            {([
              { key: 'overview',   label: 'Overview'   },
              { key: 'sections',   label: 'In-Store'   },
              { key: 'delivery',   label: 'Delivery'   },
              { key: 'responses',  label: 'Responses'  },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === t.key ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
                {t.key === 'delivery' && dn > 0 && (
                  <span className="ml-1.5 bg-white/30 text-xs px-1.5 py-0.5 rounded-full">{dn}</span>
                )}
              </button>
            ))}
          </div>

          {/* ════════════════════ OVERVIEW TAB ════════════════════ */}
          {activeTab === 'overview' && (
            <div>
              {/* ── Combined NPS summary ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {/* In-store NPS */}
                <div className={`bg-gradient-to-br ${bg} rounded-2xl p-6 text-white shadow-lg`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="w-4 h-4 text-white/80" />
                    <p className="text-white/80 text-sm font-medium">In-Store NPS</p>
                  </div>
                  <p className="text-6xl font-black leading-none mb-2">{stats.npsScore > 0 ? '+' : ''}{stats.npsScore}</p>
                  <div className="flex items-center gap-1 text-white/80 text-sm">
                    {stats.trend > 0 ? <TrendingUp className="w-4 h-4" /> : stats.trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    <span>{stats.trend > 0 ? '+' : ''}{stats.trend} vs prev period</span>
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    {n} response{n !== 1 ? 's' : ''} · {stats.npsScore >= 70 ? '🏆 World class' : stats.npsScore >= 50 ? '✅ Excellent' : stats.npsScore >= 0 ? '👍 Good' : '⚠️ Needs attention'}
                  </p>
                </div>

                {/* Delivery NPS */}
                <div className={`bg-gradient-to-br ${dbg} rounded-2xl p-6 text-white shadow-lg`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-4 h-4 text-white/80" />
                    <p className="text-white/80 text-sm font-medium">Delivery NPS</p>
                  </div>
                  {deliveryStats ? (
                    <>
                      <p className="text-6xl font-black leading-none mb-2">{deliveryStats.npsScore > 0 ? '+' : ''}{deliveryStats.npsScore}</p>
                      <div className="flex items-center gap-1 text-white/80 text-sm">
                        {deliveryStats.trend > 0 ? <TrendingUp className="w-4 h-4" /> : deliveryStats.trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        <span>{deliveryStats.trend > 0 ? '+' : ''}{deliveryStats.trend} vs prev period</span>
                      </div>
                      <p className="text-white/60 text-xs mt-1">
                        {dn} response{dn !== 1 ? 's' : ''} · {deliveryStats.npsScore >= 70 ? '🏆 World class' : deliveryStats.npsScore >= 50 ? '✅ Excellent' : deliveryStats.npsScore >= 0 ? '👍 Good' : '⚠️ Needs attention'}
                      </p>
                    </>
                  ) : (
                    <p className="text-white/60 text-lg mt-4">No delivery data yet</p>
                  )}
                </div>
              </div>

              {/* Top stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'In-Store Responses', value: n,                              sub: 'total collected',    icon: <Users className="w-4 h-4 text-gray-600" />,        ibg: 'bg-gray-100'  },
                  { label: 'Delivery Responses', value: dn,                             sub: 'app reviews',        icon: <Truck className="w-4 h-4 text-brand-orange" />,    ibg: 'bg-orange-50' },
                  { label: 'Avg In-Store',        value: stats.averageScore.toFixed(1), sub: 'out of 5',           icon: <Star className="w-4 h-4 text-yellow-600" />,       ibg: 'bg-yellow-100'},
                  { label: 'Avg Delivery',        value: deliveryStats ? deliveryStats.averageScore.toFixed(1) : '—', sub: 'out of 5', icon: <Star className="w-4 h-4 text-green-600" />, ibg: 'bg-green-50'},
                ].map(({ label, value, sub, icon, ibg }) => (
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

              {/* Promoter breakdowns side by side */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* In-store promoters */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-5">
                    <Store className="w-4 h-4 text-gray-500" />
                    <h2 className="text-lg font-bold text-gray-900">In-Store — Recommend Likelihood</h2>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: 'Promoters',  sub: 'Rated 4–5',  count: stats.promoters,  color: 'bg-green-500',  li: 'bg-green-50',  tx: 'text-green-700',  icon: <ThumbsUp className="w-4 h-4" /> },
                      { label: 'Passives',   sub: 'Rated 3',    count: stats.passives,   color: 'bg-yellow-400', li: 'bg-yellow-50', tx: 'text-yellow-700', icon: <Minus className="w-4 h-4" /> },
                      { label: 'Detractors', sub: 'Rated 1–2',  count: stats.detractors, color: 'bg-red-500',    li: 'bg-red-50',    tx: 'text-red-700',    icon: <ThumbsDown className="w-4 h-4" /> },
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
                            <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${p}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery promoters */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-5">
                    <Truck className="w-4 h-4 text-brand-orange" />
                    <h2 className="text-lg font-bold text-gray-900">Delivery — Overall Satisfaction</h2>
                  </div>
                  {!deliveryStats || dn === 0 ? (
                    <p className="text-gray-400 text-sm italic py-8 text-center">No delivery responses yet for this period.</p>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: 'Promoters',  sub: 'Rated 5',    count: deliveryStats.promoters,  color: 'bg-green-500',  li: 'bg-green-50',  tx: 'text-green-700',  icon: <ThumbsUp className="w-4 h-4" /> },
                        { label: 'Passives',   sub: 'Rated 3–4',  count: deliveryStats.passives,   color: 'bg-yellow-400', li: 'bg-yellow-50', tx: 'text-yellow-700', icon: <Minus className="w-4 h-4" /> },
                        { label: 'Detractors', sub: 'Rated 1–2',  count: deliveryStats.detractors, color: 'bg-red-500',    li: 'bg-red-50',    tx: 'text-red-700',    icon: <ThumbsDown className="w-4 h-4" /> },
                      ].map(({ label, sub, count, color, li, tx, icon }) => {
                        const p = pct(count, dn);
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
                              <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${p}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Score distributions side by side */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-5">In-Store Rating Distribution</h2>
                  <div className="flex items-end justify-between gap-1 h-36">
                    {Array.from({ length: 5 }, (_, i) => {
                      const score  = i + 1;
                      const count  = stats.scoreDistribution.find(d => d.score === score)?.count ?? 0;
                      const height = count > 0 ? Math.max((count / maxBar) * 100, 6) : 0;
                      const col    = score <= 2 ? 'bg-red-400' : score === 3 ? 'bg-yellow-400' : 'bg-green-500';
                      return (
                        <div key={score} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-400">{count > 0 ? count : ''}</span>
                          <div className={`w-full rounded-t-md ${col}`} style={{ height: `${height}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs font-medium text-gray-500">{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-5">Delivery Rating Distribution</h2>
                  {!deliveryStats || dn === 0 ? (
                    <p className="text-gray-400 text-sm italic py-8 text-center">No delivery data yet.</p>
                  ) : (
                    <div className="flex items-end justify-between gap-1 h-36">
                      {Array.from({ length: 5 }, (_, i) => {
                        const score  = i + 1;
                        const count  = deliveryStats.scoreDistribution.find(d => d.score === score)?.count ?? 0;
                        const height = count > 0 ? Math.max((count / dmaxBar) * 100, 6) : 0;
                        const col    = score <= 2 ? 'bg-red-400' : score === 3 ? 'bg-yellow-400' : 'bg-green-500';
                        return (
                          <div key={score} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-400">{count > 0 ? count : ''}</span>
                            <div className={`w-full rounded-t-md ${col}`} style={{ height: `${height}%`, minHeight: count > 0 ? 4 : 0 }} />
                            <span className="text-xs font-medium text-gray-500">{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Snapshot cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Product Variety',    value: topEntry(ss.overall.satisfaction   || {}), icon: Star,         color: 'text-yellow-500', bg: 'bg-yellow-50'  },
                  { label: 'Store Cleanliness',  value: topEntry(ss.store.cleanliness       || {}), icon: Store,        color: 'text-blue-500',   bg: 'bg-blue-50'    },
                  { label: 'Staff Helpfulness',  value: topEntry(ss.staff.friendliness      || {}), icon: UserCheck,    color: 'text-purple-500', bg: 'bg-purple-50'  },
                  { label: 'Product Quality',    value: topEntry(ss.products.quality        || {}), icon: ShoppingCart, color: 'text-green-500',  bg: 'bg-green-50'   },
                ].map(({ label, value, icon: Icon, color, bg: ibg }) => (
                  <div key={label} className={`rounded-2xl p-5 ${ibg} border border-gray-100`}>
                    <Icon className={`w-5 h-5 ${color} mb-2`} />
                    <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                    <p className="text-base font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* In-store comments */}
              {stats.threeWords.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Additional Comments</h2>
                  <div className="space-y-2">
                    {stats.threeWords.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
                        <span className="text-brand-orange mt-0.5">•</span>
                        <p className="text-sm text-gray-700">{w}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product suggestions */}
              {stats.productSuggestions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-bold text-gray-900">Requested New Products & Features</h2>
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

              {/* Delivery comments in overview */}
              {deliveryStats && deliveryStats.comments.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="w-5 h-5 text-brand-orange" />
                    <h2 className="text-lg font-bold text-gray-900">Delivery Feedback Comments</h2>
                  </div>
                  <div className="space-y-2">
                    {deliveryStats.comments.slice(0, 5).map((text, i) => (
                      <div key={i} className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
                        <Truck className="w-3.5 h-3.5 text-brand-orange mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{text}</p>
                      </div>
                    ))}
                    {deliveryStats.comments.length > 5 && (
                      <button
                        onClick={() => setActiveTab('delivery')}
                        className="text-xs text-brand-orange font-semibold mt-1 hover:underline"
                      >
                        View all {deliveryStats.comments.length} delivery comments →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ IN-STORE SECTIONS TAB ════════════════════ */}
          {activeTab === 'sections' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <SectionCard title="Overall Satisfaction" icon={Star} iconColor="text-yellow-500">
                <MetricGroup label="Product Variety Rating"                data={ss.overall.satisfaction      || {}} total={n} color="bg-yellow-400" />
                <MetricGroup label="Likelihood to Recommend TFS Vryheid"  data={ss.overall.recommendLikelihood || {}} total={n} color="bg-orange-400" />
                <MetricGroup label="Prices & Promotions Rating"            data={ss.overall.metExpectations    || {}} total={n} color="bg-amber-400"  />
              </SectionCard>

              <SectionCard title="Store Experience & Environment" icon={Store} iconColor="text-blue-500">
                <MetricGroup label="Store Cleanliness & Appearance"  data={ss.store.cleanliness || {}} total={n} color="bg-blue-500" />
                <MetricGroup label="Ease of Finding Items"           data={ss.store.easyToFind  || {}} total={n} color="bg-blue-400" />
              </SectionCard>

              <SectionCard title="Staff Performance & Service" icon={UserCheck} iconColor="text-purple-500">
                <MetricGroup label="Staff Friendliness & Helpfulness" data={ss.staff.friendliness || {}} total={n} color="bg-purple-500" />
                <MetricGroup label="Greeted by Staff"                 data={ss.staff.greeted      || {}} total={n} color="bg-purple-400" />
              </SectionCard>

              <SectionCard title="Products & Purchase Feedback" icon={ShoppingCart} iconColor="text-green-500">
                <MetricGroup label="Found All Items"                     data={ss.products.foundAllItems    || {}} total={n} color="bg-green-400"   />
                <MetricGroup label="Product Quality Rating"              data={ss.products.quality          || {}} total={n} color="bg-emerald-500" />
                <MetricGroup label="Drawn in by Promotions / Specials"   data={ss.products.promotionsDriven || {}} total={n} color="bg-teal-400"   />
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ DELIVERY TAB ════════════════════ */}
          {activeTab === 'delivery' && (
            <div>
              {!deliveryStats || dn === 0 ? (
                <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
                  <Truck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">No delivery reviews yet for this period.</p>
                  <p className="text-gray-400 text-sm mt-1">Reviews appear here after customers complete the in-app delivery survey.</p>
                </div>
              ) : (
                <div>
                  {/* Delivery average star ratings */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">Average Delivery Ratings</h2>
                    <div className="grid sm:grid-cols-2 gap-6">
                      {[
                        { label: '🚚 Delivery Speed',         value: deliveryStats.averageRatings.deliverySpeed        },
                        { label: '😊 Driver Friendliness',    value: deliveryStats.averageRatings.driverFriendliness   },
                        { label: '📦 Packaging Quality',      value: deliveryStats.averageRatings.packagingQuality      },
                        { label: '⭐ Overall Satisfaction',   value: deliveryStats.averageRatings.overallSatisfaction   },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
                          <StarBar value={value} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery section breakdowns */}
                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <SectionCard title="Delivery Experience" icon={Truck} iconColor="text-brand-orange">
                      <MetricGroup label="Delivery Speed"      data={deliveryStats.sectionStats.delivery.speed              || {}} total={dn} color="bg-brand-orange" />
                      <MetricGroup label="Driver Friendliness" data={deliveryStats.sectionStats.delivery.driverFriendliness || {}} total={dn} color="bg-amber-400"    />
                      <MetricGroup label="Packaging Quality"   data={deliveryStats.sectionStats.delivery.packagingQuality   || {}} total={dn} color="bg-yellow-400"   />
                    </SectionCard>

                    <SectionCard title="Items Received" icon={Package} iconColor="text-indigo-500">
                      <MetricGroup label="All Items Received?" data={deliveryStats.sectionStats.delivery.itemsReceived || {}} total={dn} color="bg-indigo-400" />
                      <MetricGroup label="Item Condition"      data={deliveryStats.sectionStats.delivery.itemCondition || {}} total={dn} color="bg-blue-400"   />
                    </SectionCard>

                    <SectionCard title="Overall Experience" icon={Star} iconColor="text-green-500">
                      <MetricGroup label="Overall Satisfaction" data={deliveryStats.sectionStats.overall.satisfaction || {}} total={dn} color="bg-green-500"  />
                      <MetricGroup label="Would Order Again"    data={deliveryStats.sectionStats.overall.wouldReorder  || {}} total={dn} color="bg-emerald-400" />
                    </SectionCard>
                  </div>

                  {/* Delivery comments */}
                  {deliveryStats.comments.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-bold text-gray-900">Delivery Comments ({deliveryStats.comments.length})</h2>
                      </div>
                      <div className="space-y-2">
                        {deliveryStats.comments.map((text, i) => (
                          <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <p className="text-sm text-gray-700">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ RESPONSES TAB ════════════════════ */}
          {activeTab === 'responses' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">In-Store Responses ({filteredResponses.length})</h2>
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
                      {r.overall?.satisfaction         && <span className="bg-yellow-50 text-yellow-700 rounded-lg px-2 py-1"><b>Product variety:</b> {r.overall.satisfaction}</span>}
                      {r.overall?.recommendLikelihood  && <span className="bg-orange-50 text-orange-700 rounded-lg px-2 py-1"><b>Recommend:</b> {r.overall.recommendLikelihood}</span>}
                      {r.overall?.metExpectations      && <span className="bg-amber-50 text-amber-700 rounded-lg px-2 py-1"><b>Prices & promos:</b> {r.overall.metExpectations}</span>}
                      {r.store?.cleanliness            && <span className="bg-blue-50 text-blue-700 rounded-lg px-2 py-1"><b>Cleanliness:</b> {r.store.cleanliness}</span>}
                      {r.store?.easyToFind             && <span className="bg-sky-50 text-sky-700 rounded-lg px-2 py-1"><b>Easy to find:</b> {r.store.easyToFind}</span>}
                      {r.staff?.friendliness           && <span className="bg-purple-50 text-purple-700 rounded-lg px-2 py-1"><b>Staff:</b> {r.staff.friendliness}</span>}
                      {r.staff?.greeted                && <span className="bg-violet-50 text-violet-700 rounded-lg px-2 py-1"><b>Greeted:</b> {r.staff.greeted}</span>}
                      {r.products?.foundAllItems       && <span className="bg-green-50 text-green-700 rounded-lg px-2 py-1"><b>Found items:</b> {r.products.foundAllItems}</span>}
                      {r.products?.quality             && <span className="bg-emerald-50 text-emerald-700 rounded-lg px-2 py-1"><b>Quality:</b> {r.products.quality}</span>}
                      {r.products?.promotionsDriven    && <span className="bg-teal-50 text-teal-700 rounded-lg px-2 py-1"><b>Promo visit:</b> {r.products.promotionsDriven}</span>}
                    </div>

                    {(r.overall?.oneImprovement || r.products?.newProductSuggestions) && (
                      <div className="mt-3 space-y-1.5">
                        {r.overall?.oneImprovement         && <p className="text-xs text-gray-600">💬 {r.overall.oneImprovement}</p>}
                        {r.products?.newProductSuggestions && <p className="text-xs text-gray-600">🛒 {r.products.newProductSuggestions}</p>}
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