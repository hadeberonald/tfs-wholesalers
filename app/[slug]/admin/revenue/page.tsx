'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle,
  Send, RefreshCw, AlertCircle, Building, CreditCard, ChevronDown,
  ChevronUp, ShoppingBag, Package, AlertTriangle, FileText, ClipboardCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

// ── EXACT interface from /api/admin/stats (document 8) ──────────────────────
interface Stats {
  totalOrders: number;
  totalRevenue: number;         // sum of ALL orders.total for this branch
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  completedOrders: number;      // orderStatus === 'delivered'
  cancelledOrders: number;
  outForDelivery: number;
  revenueGrowth: number;
  ordersGrowth: number;
  purchaseOrders?: {
    total: number;
    pendingApproval: number;
    confirmed: number;
    sent: number;
    awaitingReceiving: number;
    totalValue: number;         // sum of ALL purchaseOrders.total
    recentActivity: number;
  };
  inventory?: {
    lowStockCount: number;
    pendingStockTakes: number;
    overdueStockTakes: number;
    completedStockTakes: number;
  };
  resolutions?: {
    open: number;
    highPriority: number;
  };
}

interface WithdrawalRequest {
  _id: string;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
  };
  notes?: string;
  adminNotes?: string;
  paystackReference?: string;
  requestedAt: string;
  processedAt?: string;
}

const STATUS_CONFIG = {
  pending:    { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved:   { label: 'Approved',       color: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  processing: { label: 'Processing',     color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  completed:  { label: 'Completed',      color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  rejected:   { label: 'Rejected',       color: 'bg-red-100 text-red-700',      icon: XCircle },
};

const SA_BANKS = [
  { name: 'ABSA Bank',      code: '057' },
  { name: 'FNB',            code: '632005' },
  { name: 'Standard Bank',  code: '051' },
  { name: 'Capitec Bank',   code: '198765' },
  { name: 'Nedbank',        code: '580105' },
  { name: 'African Bank',   code: '679000' },
  { name: 'Investec',       code: '442' },
  { name: 'Discovery Bank', code: '470010' },
  { name: 'TymeBank',       code: '250655' },
];

export default function RevenuePage() {
  const params = useParams();
  const slug   = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();

  const [stats, setStats]             = useState<Stats | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  // form
  const [amount, setAmount]       = useState('');
  const [accName, setAccName]     = useState('');
  const [accNum, setAccNum]       = useState('');
  const [bank, setBank]           = useState('');
  const [notes, setNotes]         = useState('');

  useEffect(() => {
    if (!branchLoading && branch) fetchAll();
  }, [branchLoading, branch]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch('/api/admin/stats'),          // THE real stats endpoint
        fetch('/api/revenue/withdrawals'),
      ]);
      if (sRes.ok) setStats((await sRes.json()).stats);
      if (wRes.ok) setWithdrawals((await wRes.json()).withdrawals ?? []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ── Money maths — derived directly from the stats fields ─────────────────
  const totalRevenue   = stats?.totalRevenue   ?? 0;   // all orders summed
  const poSpend        = stats?.purchaseOrders?.totalValue ?? 0; // all POs summed
  const grossProfit    = totalRevenue - poSpend;        // rough margin

  const withdrawn      = withdrawals
    .filter(w => w.status === 'completed')
    .reduce((s, w) => s + w.amount, 0);
  const pendingW       = withdrawals
    .filter(w => ['pending','approved','processing'].includes(w.status))
    .reduce((s, w) => s + w.amount, 0);
  const available      = Math.max(totalRevenue - withdrawn - pendingW, 0);

  const handleSubmit = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0)                        { toast.error('Enter a valid amount');        return; }
    if (!accName || !accNum || !bank)        { toast.error('Fill in all bank details');    return; }
    if (a > available)                       { toast.error('Exceeds available balance');   return; }

    const chosen = SA_BANKS.find(b => b.code === bank);
    setSubmitting(true);
    try {
      const res = await fetch('/api/revenue/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: a,
          bankDetails: { accountName: accName, accountNumber: accNum, bankName: chosen?.name ?? bank, bankCode: bank },
          notes,
        }),
      });
      if (res.ok) {
        toast.success('Withdrawal request submitted!');
        setShowForm(false);
        setAmount(''); setAccName(''); setAccNum(''); setBank(''); setNotes('');
        fetchAll();
      } else {
        toast.error((await res.json()).error ?? 'Failed to submit');
      }
    } catch { toast.error('An error occurred'); }
    finally  { setSubmitting(false); }
  };

  const fmt     = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-1">Revenue</h1>
            <p className="text-gray-600">{branch?.displayName} — financial overview</p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Request Withdrawal</span>
            {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* ── Top money cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

          {/* Revenue — the real number from stats.totalRevenue */}
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <ShoppingBag className="w-5 h-5 opacity-70" />
              {stats?.revenueGrowth !== 0 && (
                <span className="text-xs font-bold flex items-center space-x-1 bg-white/20 px-2 py-0.5 rounded-full">
                  {(stats?.revenueGrowth ?? 0) > 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />}
                  <span>{stats?.revenueGrowth}%</span>
                </span>
              )}
            </div>
            <p className="text-white/80 text-xs mb-0.5">Total Revenue</p>
            <p className="text-2xl font-bold">{fmt(totalRevenue)}</p>
            <p className="text-white/60 text-xs mt-1">
              {stats?.totalOrders ?? 0} orders · {stats?.completedOrders ?? 0} delivered
            </p>
          </div>

          {/* Available to withdraw */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs mb-1">Available to Withdraw</p>
            <p className="text-2xl font-bold text-green-600">{fmt(available)}</p>
            <p className="text-xs text-gray-400 mt-1">Revenue − withdrawals</p>
          </div>

          {/* Withdrawn */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs mb-1">Total Withdrawn</p>
            <p className="text-2xl font-bold text-brand-black">{fmt(withdrawn)}</p>
            {pendingW > 0 && (
              <p className="text-xs text-yellow-600 mt-1">{fmt(pendingW)} pending</p>
            )}
          </div>

          {/* PO spend */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs mb-1">PO Spend (All Time)</p>
            <p className="text-2xl font-bold text-brand-black">{fmt(poSpend)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.purchaseOrders?.total ?? 0} purchase orders</p>
          </div>
        </div>

        {/* Gross profit banner */}
        <div className={`rounded-xl px-5 py-3 mb-6 flex items-center justify-between text-sm font-medium ${
          grossProfit >= 0
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span>Estimated Gross Profit (Revenue − PO Spend)</span>
          <span className="text-base font-bold">{fmt(grossProfit)}</span>
        </div>

        {/* ── Secondary operational stats ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Pending Orders',     value: stats?.pendingOrders    ?? 0, icon: Clock,          color: 'text-yellow-600' },
            { label: 'Delivered',          value: stats?.completedOrders  ?? 0, icon: CheckCircle,    color: 'text-green-600'  },
            { label: 'Cancelled',          value: stats?.cancelledOrders  ?? 0, icon: XCircle,        color: 'text-red-500'    },
            { label: 'Open Resolutions',   value: stats?.resolutions?.open         ?? 0, icon: AlertTriangle,  color: 'text-red-600'    },
            { label: 'Low Stock',          value: stats?.inventory?.lowStockCount  ?? 0, icon: Package,        color: 'text-orange-600' },
            { label: 'Overdue Stock Takes',value: stats?.inventory?.overdueStockTakes ?? 0, icon: ClipboardCheck, color: 'text-yellow-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
              <c.icon className={`w-4 h-4 ${c.color} mx-auto mb-1`} />
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* ── Purchase order breakdown ─────────────────────────────────────── */}
        {stats?.purchaseOrders && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-8">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center space-x-2">
              <FileText className="w-4 h-4" /><span>Purchase Order Breakdown</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total POs',         value: stats.purchaseOrders.total },
                { label: 'Pending Approval',  value: stats.purchaseOrders.pendingApproval },
                { label: 'Awaiting Receiving',value: stats.purchaseOrders.awaitingReceiving },
                { label: 'Recent (7 days)',   value: stats.purchaseOrders.recentActivity },
              ].map(c => (
                <div key={c.label} className="text-center">
                  <p className="text-2xl font-bold text-brand-black">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Withdrawal request form ──────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border-2 border-brand-orange/30">
            <h2 className="text-xl font-bold text-brand-black mb-1 flex items-center space-x-2">
              <Send className="w-5 h-5 text-brand-orange" /><span>New Withdrawal Request</span>
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Super admin reviews all requests before any payment is processed via Paystack.
            </p>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount to Withdraw *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R</span>
                  <input
                    type="number" step="0.01" min="0" max={available}
                    className="input-field pl-7 text-lg font-bold"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Available: <span className="font-semibold text-green-600">{fmt(available)}</span>
                  <button type="button" onClick={() => setAmount(available.toFixed(2))}
                    className="ml-2 text-brand-orange hover:underline text-xs">Use max</button>
                </p>
              </div>

              {/* Bank details */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
                  <Building className="w-4 h-4" /><span>Your Bank Details</span>
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder Name *</label>
                    <input type="text" className="input-field" placeholder="e.g. TFS Vryheid (Pty) Ltd"
                      value={accName} onChange={e => setAccName(e.target.value)} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
                      <input type="text" className="input-field" placeholder="e.g. 1234567890"
                        value={accNum} onChange={e => setAccNum(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank *</label>
                      <select className="input-field" value={bank} onChange={e => setBank(e.target.value)}>
                        <option value="">Select bank…</option>
                        {SA_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                    <textarea rows={2} className="input-field" placeholder="Any notes for super admin…"
                      value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-gray-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Super admin reviews before processing</span>
                </p>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center space-x-2">
                  {submitting
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Submitting…</span></>
                    : <><Send className="w-4 h-4" /><span>Submit Request</span></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Withdrawal history ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-black">Withdrawal History</h2>
            <span className="text-sm text-gray-500">{withdrawals.length} requests</span>
          </div>

          {withdrawals.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No withdrawal requests yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {withdrawals.map(w => {
                const conf  = STATUS_CONFIG[w.status];
                const SIcon = conf.icon;
                return (
                  <div key={w._id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 text-lg">{fmt(w.amount)}</p>
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${conf.color}`}>
                            <SIcon className="w-3 h-3" /><span>{conf.label}</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{w.bankDetails.accountName} · {w.bankDetails.bankName}</span>
                          <span className="text-gray-400">****{w.bankDetails.accountNumber.slice(-4)}</span>
                        </div>
                        {w.notes      && <p className="text-xs text-gray-500 mt-1">{w.notes}</p>}
                        {w.adminNotes && <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">Admin: {w.adminNotes}</p>}
                        {w.paystackReference && <p className="text-xs text-gray-400 font-mono mt-1">Ref: {w.paystackReference}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-400 flex-shrink-0">
                        <p>{fmtDate(w.requestedAt)}</p>
                        {w.processedAt && <p>Done {fmtDate(w.processedAt)}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}