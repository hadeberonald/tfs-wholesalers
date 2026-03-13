'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Plus, Users, Activity, Pause, Play, Trash2, Edit,
  Loader2, MapPin, DollarSign, Clock, CheckCircle, XCircle,
  RefreshCw, CreditCard, Building, Send, TrendingUp,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  settings: { storeLocation: { address: string } };
  createdAt: string;
}

// Same shape the /api/super-admin/revenue route returns
interface BranchRevenue {
  branchId: string;
  branchName: string;
  slug: string;
  totalRevenue: number;       // sum of ALL orders.total — mirrors stats.totalRevenue
  totalOrders: number;
  completedOrders: number;
  poSpend: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  available: number;
}

interface WithdrawalRequest {
  _id: string;
  branchId: string;
  branchName?: string;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bankDetails: { accountName: string; accountNumber: string; bankName: string; bankCode: string };
  notes?: string;
  adminNotes?: string;
  paystackReference?: string;
  requestedAt: string;
  processedAt?: string;
}

const W_STATUS = {
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved:   { label: 'Approved',   color: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  rejected:   { label: 'Rejected',   color: 'bg-red-100 text-red-700',      icon: XCircle },
};

export default function SuperAdminDashboard() {
  const router              = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [branches, setBranches]           = useState<Branch[]>([]);
  const [revenue, setRevenue]             = useState<BranchRevenue[]>([]);
  const [withdrawals, setWithdrawals]     = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [processingId, setProcessingId]   = useState<string | null>(null);
  const [adminNotes, setAdminNotes]       = useState<Record<string, string>>({});

  // collapsible panels
  const [showRevenue, setShowRevenue]           = useState(true);
  const [showWithdrawals, setShowWithdrawals]   = useState(true);
  const [showBranches, setShowBranches]         = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super-admin')) router.push('/login');
    else if (user?.role === 'super-admin') fetchAll();
  }, [user, authLoading]);

  const fetchAll = async () => {
    try {
      const [bRes, rRes, wRes] = await Promise.all([
        fetch('/api/super-admin/branches'),
        fetch('/api/super-admin/revenue'),
        fetch('/api/super-admin/withdrawals'),
      ]);
      if (bRes.ok) setBranches((await bRes.json()).branches ?? []);
      if (rRes.ok) setRevenue((await rRes.json()).revenue ?? []);
      if (wRes.ok) setWithdrawals((await wRes.json()).withdrawals ?? []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ── Branch actions ───────────────────────────────────────────────────────
  const toggleStatus = async (id: string, cur: string) => {
    const next = cur === 'active' ? 'paused' : 'active';
    const res  = await fetch(`/api/super-admin/branches/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) { toast.success(`Branch ${next === 'active' ? 'activated' : 'paused'}`); fetchAll(); }
    else toast.error('Failed to update branch');
  };

  const deleteBranch = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/super-admin/branches/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Branch deleted'); fetchAll(); }
    else toast.error((await res.json()).error ?? 'Failed to delete');
  };

  // ── Withdrawal actions ───────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const res = await fetch(`/api/super-admin/withdrawals/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', adminNotes: adminNotes[id] ?? '' }),
    });
    if (res.ok) { toast.success('Approved'); fetchAll(); } else toast.error('Failed');
    setProcessingId(null);
  };

  const handleProcess = async (id: string) => {
    const w = withdrawals.find(x => x._id === id);
    if (!w || !confirm(`Send ${fmt(w.amount)} to ${w.bankDetails.accountName} via Paystack?`)) return;
    setProcessingId(id);
    const res  = await fetch(`/api/super-admin/withdrawals/${id}/process`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) { toast.success('Transfer initiated!'); fetchAll(); } else toast.error(data.error ?? 'Failed');
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setProcessingId(id);
    const res = await fetch(`/api/super-admin/withdrawals/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', adminNotes: reason }),
    });
    if (res.ok) { toast.success('Rejected'); fetchAll(); }
    setProcessingId(null);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmt     = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  const pendingW  = withdrawals.filter(w => w.status === 'pending');
  const approvedW = withdrawals.filter(w => w.status === 'approved');
  const historyW  = withdrawals.filter(w => !['pending','approved'].includes(w.status));

  const sysRevenue   = revenue.reduce((s, b) => s + b.totalRevenue, 0);
  const sysAvailable = revenue.reduce((s, b) => s + b.available,    0);
  const sysPoSpend   = revenue.reduce((s, b) => s + b.poSpend,      0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }
  if (!user || user.role !== 'super-admin') return null;

  // ── Shared collapsible header ────────────────────────────────────────────
  const Section = ({
    open, setOpen, icon: Icon, title, badge, badgeColor, children,
  }: {
    open: boolean; setOpen: (v: boolean) => void;
    icon: any; title: string; badge?: string; badgeColor?: string; children: React.ReactNode;
  }) => (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Icon className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-brand-black">{title}</h2>
          {badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-gray-100 text-gray-600'}`}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-1">Super Admin</h1>
            <p className="text-gray-600">System-wide management</p>
          </div>
          <Link href="/super-admin/branches/new" className="btn-primary flex items-center space-x-2">
            <Plus className="w-5 h-5" /><span>Create Branch</span>
          </Link>
        </div>

        {/* Top KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <Store className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Total Branches</p>
            <p className="text-3xl font-bold">{branches.length}</p>
            <p className="text-white/60 text-xs mt-1">{branches.filter(b=>b.status==='active').length} active</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
            <DollarSign className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">System Revenue</p>
            <p className="text-2xl font-bold">{fmt(sysRevenue)}</p>
            <p className="text-white/60 text-xs mt-1">All branches, all orders</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
            <TrendingUp className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Available to Pay Out</p>
            <p className="text-2xl font-bold">{fmt(sysAvailable)}</p>
            <p className="text-white/60 text-xs mt-1">Across all branches</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white shadow-lg">
            <Clock className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Pending Withdrawals</p>
            <p className="text-3xl font-bold">{pendingW.length}</p>
            <p className="text-white/60 text-xs mt-1">{fmt(pendingW.reduce((s,w)=>s+w.amount,0))} total</p>
          </div>
        </div>

        {/* ── Branch Revenue Table ─────────────────────────────────────────── */}
        <Section open={showRevenue} setOpen={setShowRevenue} icon={TrendingUp} title="Branch Revenue Overview">
          {revenue.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No revenue data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Branch','Revenue (all orders)','Orders','Delivered','PO Spend','Gross Profit','Withdrawn','Pending','Available'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenue.map(b => {
                    const grossProfit = b.totalRevenue - b.poSpend;
                    return (
                      <tr key={b.branchId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 whitespace-nowrap">{b.branchName}</p>
                          <Link href={`/${b.slug}/admin`} className="text-xs text-brand-orange hover:underline">/{b.slug}</Link>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">{fmt(b.totalRevenue)}</td>
                        <td className="px-4 py-3 text-gray-700">{b.totalOrders}</td>
                        <td className="px-4 py-3 text-gray-700">{b.completedOrders}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(b.poSpend)}</td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt(grossProfit)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(b.totalWithdrawn)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {b.pendingWithdrawals > 0
                            ? <span className="text-yellow-600 font-medium">{fmt(b.pendingWithdrawals)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-bold text-brand-orange whitespace-nowrap">{fmt(b.available)}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-green-600">{fmt(sysRevenue)}</td>
                    <td className="px-4 py-3">{revenue.reduce((s,b)=>s+b.totalOrders,0)}</td>
                    <td className="px-4 py-3">{revenue.reduce((s,b)=>s+b.completedOrders,0)}</td>
                    <td className="px-4 py-3">{fmt(sysPoSpend)}</td>
                    <td className={`px-4 py-3 ${sysRevenue-sysPoSpend>=0?'text-green-600':'text-red-500'}`}>{fmt(sysRevenue-sysPoSpend)}</td>
                    <td className="px-4 py-3">{fmt(revenue.reduce((s,b)=>s+b.totalWithdrawn,0))}</td>
                    <td className="px-4 py-3 text-yellow-600">{fmt(revenue.reduce((s,b)=>s+b.pendingWithdrawals,0))}</td>
                    <td className="px-4 py-3 text-brand-orange">{fmt(sysAvailable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── Withdrawal Requests ──────────────────────────────────────────── */}
        <Section
          open={showWithdrawals} setOpen={setShowWithdrawals}
          icon={Send} title="Withdrawal Requests"
          badge={pendingW.length > 0 ? `${pendingW.length} pending` : undefined}
          badgeColor="bg-yellow-100 text-yellow-700"
        >
          {withdrawals.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No withdrawal requests</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...pendingW, ...approvedW, ...historyW].map(w => {
                const conf  = W_STATUS[w.status];
                const WIcon = conf.icon;
                const isP   = processingId === w._id;

                return (
                  <div key={w._id} className={`px-6 py-4 ${
                    w.status === 'pending'  ? 'bg-yellow-50/40' :
                    w.status === 'approved' ? 'bg-blue-50/40'   : ''
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 text-lg">{fmt(w.amount)}</p>
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${conf.color}`}>
                            <WIcon className="w-3 h-3" /><span>{conf.label}</span>
                          </span>
                          {w.branchName && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {w.branchName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {w.bankDetails.accountName} · {w.bankDetails.bankName} ****{w.bankDetails.accountNumber.slice(-4)}
                          </span>
                        </div>

                        {w.notes      && <p className="text-xs text-gray-500 italic mb-1">"{w.notes}"</p>}
                        {w.adminNotes && <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1">Note: {w.adminNotes}</p>}
                        {w.paystackReference && <p className="text-xs text-gray-400 font-mono">Ref: {w.paystackReference}</p>}

                        {/* Approve / Reject */}
                        {w.status === 'pending' && (
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <input type="text" placeholder="Admin note (optional)"
                              className="input-field text-xs py-1.5 flex-1 min-w-32"
                              value={adminNotes[w._id] ?? ''}
                              onChange={e => setAdminNotes(p => ({ ...p, [w._id]: e.target.value }))}
                            />
                            <button onClick={() => handleApprove(w._id)} disabled={isP}
                              className="btn-primary text-xs px-3 py-1.5 flex items-center space-x-1 whitespace-nowrap">
                              <CheckCircle className="w-3.5 h-3.5" /><span>{isP ? '…' : 'Approve'}</span>
                            </button>
                            <button onClick={() => handleReject(w._id)} disabled={isP}
                              className="btn-secondary text-xs px-3 py-1.5 text-red-600 border-red-200 flex items-center space-x-1 whitespace-nowrap">
                              <XCircle className="w-3.5 h-3.5" /><span>Reject</span>
                            </button>
                          </div>
                        )}

                        {/* Send payment */}
                        {w.status === 'approved' && (
                          <button onClick={() => handleProcess(w._id)} disabled={isP}
                            className="btn-primary text-xs px-4 py-1.5 flex items-center space-x-2 mt-3">
                            {isP
                              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Processing…</span></>
                              : <><Send className="w-3.5 h-3.5" /><span>Send via Paystack Transfer</span></>}
                          </button>
                        )}
                      </div>

                      <div className="text-right text-xs text-gray-400 flex-shrink-0">
                        <p>{fmtDate(w.requestedAt)}</p>
                        {w.processedAt && <p className="mt-0.5">Done {fmtDate(w.processedAt)}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── Branches List ────────────────────────────────────────────────── */}
        <Section
          open={showBranches} setOpen={setShowBranches}
          icon={Store} title="All Branches"
          badge={String(branches.length)}
          badgeColor="bg-gray-100 text-gray-600"
        >
          {branches.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Branches Yet</h3>
              <Link href="/super-admin/branches/new" className="btn-primary inline-flex items-center space-x-2">
                <Plus className="w-5 h-5" /><span>Create First Branch</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {branches.map(branch => {
                const rev = revenue.find(r => r.slug === branch.slug);
                return (
                  <div key={branch._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-brand-black">{branch.displayName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            branch.status === 'active'  ? 'bg-green-100 text-green-700' :
                            branch.status === 'paused'  ? 'bg-yellow-100 text-yellow-700' :
                                                          'bg-gray-100 text-gray-600'
                          }`}>{branch.status.toUpperCase()}</span>
                          {rev && (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              {fmt(rev.totalRevenue)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{branch.settings.storeLocation.address}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">/{branch.slug}</p>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <Link href={`/super-admin/branches/${branch._id}`}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Edit">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => toggleStatus(branch._id, branch.status)}
                          className={`p-2 rounded-lg transition-colors ${branch.status === 'active' ? 'hover:bg-yellow-50 text-yellow-600' : 'hover:bg-green-50 text-green-600'}`}>
                          {branch.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deleteBranch(branch._id, branch.displayName)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/${branch.slug}/admin`}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors">
                          Admin
                        </Link>
                        <Link href={`/${branch.slug}`} target="_blank"
                          className="px-3 py-1.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors">
                          Store
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}