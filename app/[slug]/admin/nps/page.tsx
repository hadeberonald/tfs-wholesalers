'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TrendingUp, TrendingDown, Users, MessageSquare, Star, ThumbsUp, ThumbsDown, Minus, Tag, Calendar, ChevronDown } from 'lucide-react';

interface NPSResponse {
  _id: string;
  score: number;
  tags: string[];
  comment: string;
  submittedAt: string;
  source: string;
}

interface NPSStats {
  totalResponses: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  averageScore: number;
  topTags: { tag: string; count: number }[];
  scoreDistribution: { score: number; count: number }[];
  recentResponses: NPSResponse[];
  trend: number;
}

const PERIOD_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

export default function NPSResultsPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [stats, setStats] = useState<NPSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [responses, setResponses] = useState<NPSResponse[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'promoter' | 'passive' | 'detractor'>('all');

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nps/stats?branchSlug=${slug}&period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setResponses(data.stats.recentResponses || []);
      }
    } catch (err) {
      console.error('Failed to fetch NPS stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' });

  const getScoreType = (score: number) => {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 9) return 'bg-green-100 text-green-700';
    if (score >= 7) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const filteredResponses = responses.filter(r => {
    if (filter === 'all') return true;
    return getScoreType(r.score) === filter;
  });

  const maxBarCount = stats ? Math.max(...stats.scoreDistribution.map(d => d.count), 1) : 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 flex items-center justify-center">
        <p className="text-gray-500">No NPS data found.</p>
      </div>
    );
  }

  const npsColor = stats.npsScore >= 50 ? 'text-green-600' : stats.npsScore >= 0 ? 'text-yellow-600' : 'text-red-600';
  const npsBg = stats.npsScore >= 50 ? 'from-green-500 to-emerald-600' : stats.npsScore >= 0 ? 'from-yellow-400 to-orange-500' : 'from-red-500 to-rose-600';

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-1">NPS Results</h1>
            <p className="text-gray-500">In-store customer satisfaction tracking</p>
          </div>

          {/* Period selector */}
          <div className="relative inline-flex items-center">
            <Calendar className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-orange shadow-sm"
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Top stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">

          {/* NPS Score — hero card */}
          <div className={`col-span-2 lg:col-span-1 bg-gradient-to-br ${npsBg} rounded-2xl p-6 text-white shadow-lg`}>
            <p className="text-white/80 text-sm font-medium mb-1">NPS Score</p>
            <p className="text-6xl font-black leading-none mb-2">
              {stats.npsScore > 0 ? '+' : ''}{stats.npsScore}
            </p>
            <div className="flex items-center space-x-1 text-white/80 text-sm">
              {stats.trend > 0 ? <TrendingUp className="w-4 h-4" /> : stats.trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              <span>{stats.trend > 0 ? '+' : ''}{stats.trend} vs previous period</span>
            </div>
            <p className="text-white/60 text-xs mt-2">
              {stats.npsScore >= 70 ? '🏆 World class' : stats.npsScore >= 50 ? '✅ Excellent' : stats.npsScore >= 0 ? '👍 Good' : '⚠️ Needs attention'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-2 bg-gray-100 rounded-lg"><Users className="w-4 h-4 text-gray-600" /></div>
              <p className="text-sm text-gray-500 font-medium">Total Responses</p>
            </div>
            <p className="text-4xl font-black text-brand-black">{stats.totalResponses}</p>
            <p className="text-xs text-gray-400 mt-1">in selected period</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><Star className="w-4 h-4 text-yellow-600" /></div>
              <p className="text-sm text-gray-500 font-medium">Avg Score</p>
            </div>
            <p className="text-4xl font-black text-brand-black">{stats.averageScore.toFixed(1)}</p>
            <p className="text-xs text-gray-400 mt-1">out of 10</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg"><MessageSquare className="w-4 h-4 text-blue-600" /></div>
              <p className="text-sm text-gray-500 font-medium">With Comments</p>
            </div>
            <p className="text-4xl font-black text-brand-black">
              {responses.filter(r => r.comment?.trim()).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">written responses</p>
          </div>
        </div>

        {/* Promoter breakdown + Score distribution */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">

          {/* Promoter / Passive / Detractor */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-brand-black mb-5">Response Breakdown</h2>
            <div className="space-y-4">
              {[
                { label: 'Promoters', sublabel: 'Score 9–10', count: stats.promoters, color: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700', icon: <ThumbsUp className="w-4 h-4" /> },
                { label: 'Passives', sublabel: 'Score 7–8', count: stats.passives, color: 'bg-yellow-400', light: 'bg-yellow-50', text: 'text-yellow-700', icon: <Minus className="w-4 h-4" /> },
                { label: 'Detractors', sublabel: 'Score 0–6', count: stats.detractors, color: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', icon: <ThumbsDown className="w-4 h-4" /> },
              ].map(({ label, sublabel, count, color, light, text, icon }) => {
                const pct = stats.totalResponses > 0 ? Math.round((count / stats.totalResponses) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${light} ${text}`}>{icon}</div>
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{label}</span>
                          <span className="text-xs text-gray-400 ml-2">{sublabel}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-800">{count}</span>
                        <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-2.5 rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score distribution */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-brand-black mb-5">Score Distribution</h2>
            <div className="flex items-end justify-between gap-1 h-36">
              {Array.from({ length: 11 }, (_, i) => {
                const item = stats.scoreDistribution.find(d => d.score === i);
                const count = item?.count ?? 0;
                const height = maxBarCount > 0 ? Math.max((count / maxBarCount) * 100, count > 0 ? 6 : 0) : 0;
                const barColor = i <= 6 ? 'bg-red-400' : i <= 8 ? 'bg-yellow-400' : 'bg-green-500';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400">{count > 0 ? count : ''}</span>
                    <div
                      className={`w-full rounded-t-md ${barColor} transition-all duration-500`}
                      style={{ height: `${height}%`, minHeight: count > 0 ? 4 : 0 }}
                    />
                    <span className="text-xs font-medium text-gray-500">{i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top tags */}
        {stats.topTags.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center space-x-2 mb-5">
              <Tag className="w-5 h-5 text-brand-orange" />
              <h2 className="text-lg font-bold text-brand-black">Top Tags</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(({ tag, count }) => (
                <div key={tag} className="flex items-center space-x-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-2">
                  <span className="text-sm font-semibold text-brand-black">{tag}</span>
                  <span className="text-xs font-bold text-brand-orange bg-white border border-orange-200 rounded-full px-2 py-0.5">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments / Responses */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-brand-black">Recent Responses</h2>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'promoter', 'passive', 'detractor'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      filter === f
                        ? 'bg-brand-orange text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            ) : (
              filteredResponses.map(r => (
                <div key={r._id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${getScoreBadge(r.score)}`}>
                        {r.score}
                      </div>
                      <div>
                        {r.comment && (
                          <p className="text-sm text-gray-700 mb-1.5">"{r.comment}"</p>
                        )}
                        {r.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.tags.map(tag => (
                              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                        {!r.comment && !r.tags?.length && (
                          <p className="text-sm text-gray-400 italic">No comment left</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{formatDate(r.submittedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}