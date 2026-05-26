'use client';
/**
 * app/[slug]/admin/refunds/_page.tsx
 *
 * Manual Refund Approval — shown under the main nav.
 * Handles refunds that were auto-created when a picker marked an item OOS
 * and the payment method doesn't support automatic processing (cash, manual,
 * unimplemented providers) or where the Paystack call failed.
 *
 * Permissions respected:
 *   - refunds:read  → can view the list
 *   - refunds:write → can approve / reject / mark as processed
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Loader2,
  BadgeCheck,
  Ban,
  Info,
  Receipt,
  Package,
  User,
  Phone,
  Mail,
  Hash,
  Banknote,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RefundStatus =
  | 'pending'
  | 'manual_required'
  | 'processed'
  | 'approved'
  | 'rejected'
  | 'failed';

interface Refund {
  _id: string;
  orderId: string;
  orderNumber: string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  itemSku?: string;
  itemName?: string;
  refundAmount: number;
  currency: string;
  paymentMethod?: string;
  paymentRef?: string;
  status: RefundStatus;
  reason?: string;
  note?: string;
  providerRef?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<
  RefundStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  manual_required: {
    label: 'Manual Required',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  processed: {
    label: 'Processed',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Approved',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <BadgeCheck className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <Ban className="w-3.5 h-3.5" />,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: RefundStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color} ${meta.bg}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

interface ConfirmModalProps {
  refund: Refund;
  action: 'approved' | 'rejected' | 'processed';
  onConfirm: (note: string) => void;
  onCancel: () => void;
  saving: boolean;
}

function ConfirmModal({ refund, action, onConfirm, onCancel, saving }: ConfirmModalProps) {
  const [note, setNote] = useState('');

  const config = {
    approved: {
      title: 'Approve Refund',
      description: `Approve a refund of R${refund.refundAmount.toFixed(2)} for ${refund.customerName ?? 'customer'}?`,
      hint: 'Add a note about how/when the refund will be issued.',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700',
      btnLabel: 'Approve',
    },
    rejected: {
      title: 'Reject Refund',
      description: `Reject the refund request for order ${refund.orderNumber}?`,
      hint: 'Please provide a reason for rejecting this refund.',
      btnClass: 'bg-red-600 hover:bg-red-700',
      btnLabel: 'Reject',
    },
    processed: {
      title: 'Mark as Processed',
      description: `Confirm that the R${refund.refundAmount.toFixed(2)} refund has been processed manually?`,
      hint: 'e.g. reference number, date processed, or other details.',
      btnClass: 'bg-blue-600 hover:bg-blue-700',
      btnLabel: 'Mark Processed',
    },
  }[action];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{config.description}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">{config.hint}</p>
            <textarea
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="p-5 border-t flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl text-sm shadow-sm disabled:opacity-50 ${config.btnClass}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {config.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RefundRowProps {
  refund: Refund;
  canWrite: boolean;
  onAction: (refund: Refund, action: 'approved' | 'rejected' | 'processed') => void;
}

function RefundRow({ refund, canWrite, onAction }: RefundRowProps) {
  const [expanded, setExpanded] = useState(false);
  const actionable = refund.status === 'pending' || refund.status === 'manual_required' || refund.status === 'failed';
  const paymentIcon = refund.paymentMethod === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Order number */}
        <div className="flex items-center gap-1.5 min-w-[130px]">
          <Hash className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">{refund.orderNumber}</span>
        </div>

        {/* Customer */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-700 truncate">{refund.customerName ?? '—'}</span>
        </div>

        {/* Item */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600 truncate">{refund.itemName ?? refund.itemSku ?? '—'}</span>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-1 min-w-[90px]">
          <span className="text-sm font-bold text-brand-black">
            R{refund.refundAmount.toFixed(2)}
          </span>
        </div>

        {/* Payment method */}
        <div className="flex items-center gap-1.5 min-w-[90px]">
          {paymentIcon}
          <span className="text-xs text-gray-500 capitalize">{refund.paymentMethod ?? '—'}</span>
        </div>

        {/* Status */}
        <div className="min-w-[140px]">
          <StatusBadge status={refund.status as RefundStatus} />
        </div>

        {/* Date */}
        <div className="text-xs text-gray-400 min-w-[90px]">
          {new Date(refund.createdAt).toLocaleDateString()}
        </div>

        {/* Actions */}
        {canWrite && actionable && (
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              onClick={() => onAction(refund, 'approved')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-200 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve
            </button>
            {refund.paymentMethod === 'cash' && (
              <button
                onClick={() => onAction(refund, 'processed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors"
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                Processed
              </button>
            )}
            <button
              onClick={() => onAction(refund, 'rejected')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs rounded-lg border border-red-200 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={refund.customerEmail} />
            <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={refund.customerPhone} />
            <DetailItem icon={<Hash className="w-3.5 h-3.5" />} label="SKU" value={refund.itemSku} />
            <DetailItem icon={<Receipt className="w-3.5 h-3.5" />} label="Payment Ref" value={refund.paymentRef} />
            <DetailItem icon={<Info className="w-3.5 h-3.5" />} label="Reason" value={refund.reason} />
            {refund.providerRef && (
              <DetailItem icon={<BadgeCheck className="w-3.5 h-3.5" />} label="Provider Ref" value={refund.providerRef} />
            )}
            {refund.note && (
              <div className="sm:col-span-2 md:col-span-3">
                <DetailItem icon={<Info className="w-3.5 h-3.5" />} label="Note" value={refund.note} />
              </div>
            )}
            {refund.resolvedAt && (
              <DetailItem
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Resolved"
                value={new Date(refund.resolvedAt).toLocaleString()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RefundsInnerPage() {
  const { can } = useAuth();
  const canWrite = can('refunds:write');

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    refund: Refund;
    action: 'approved' | 'rejected' | 'processed';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRefunds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/refunds${params}`);
      if (!res.ok) { toast.error('Failed to load refunds'); return; }
      const data = await res.json();
      setRefunds(data.refunds ?? []);
    } catch {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const handleAction = (refund: Refund, action: 'approved' | 'rejected' | 'processed') => {
    setConfirmState({ refund, action });
  };

  const handleConfirm = async (note: string) => {
    if (!confirmState) return;
    setSaving(true);
    try {
      const res = await fetch('/api/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId: confirmState.refund._id,
          status: confirmState.action,
          note,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to update refund');
        return;
      }
      const labels: Record<string, string> = {
        approved: 'Refund approved',
        rejected: 'Refund rejected',
        processed: 'Refund marked as processed',
      };
      toast.success(labels[confirmState.action] ?? 'Updated');
      setConfirmState(null);
      fetchRefunds(true);
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Filter locally for search
  const filtered = refunds.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.orderNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerEmail?.toLowerCase().includes(q) ||
      r.itemName?.toLowerCase().includes(q) ||
      r.itemSku?.toLowerCase().includes(q)
    );
  });

  // Stats
  const pendingCount = refunds.filter(
    (r) => r.status === 'pending' || r.status === 'manual_required'
  ).length;
  const processedCount = refunds.filter(
    (r) => r.status === 'processed' || r.status === 'approved'
  ).length;
  const rejectedCount = refunds.filter((r) => r.status === 'rejected').length;
  const totalAmount = refunds
    .filter((r) => r.status !== 'rejected')
    .reduce((sum, r) => sum + r.refundAmount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refund Approvals</h1>
            <p className="text-gray-500 mt-1">
              Review and action OOS refund requests that require manual processing.
            </p>
          </div>
          <button
            onClick={() => fetchRefunds(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">About manual refunds</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              These refunds were auto-created when a picker marked an item as out of stock.
            
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Awaiting Action"
            value={pendingCount}
            color="bg-amber-100"
            icon={<Clock className="w-5 h-5 text-amber-600" />}
          />
          <StatCard
            label="Processed / Approved"
            value={processedCount}
            color="bg-emerald-100"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          />
          <StatCard
            label="Rejected"
            value={rejectedCount}
            color="bg-red-100"
            icon={<XCircle className="w-5 h-5 text-red-500" />}
          />
          <StatCard
            label="Total Value"
            value={`R${totalAmount.toFixed(2)}`}
            color="bg-blue-100"
            icon={<Banknote className="w-5 h-5 text-blue-600" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search order, customer, item…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="manual_required">Manual Required</option>
                <option value="approved">Approved</option>
                <option value="processed">Processed</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-10 h-10 text-orange-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500 text-sm">Loading refunds…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center border border-gray-100">
            <Receipt className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No refunds found</h3>
            <p className="text-gray-500 text-sm">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Refunds will appear here when a picker marks an item as out of stock.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((refund) => (
              <RefundRow
                key={refund._id}
                refund={refund}
                canWrite={canWrite}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <ConfirmModal
          refund={confirmState.refund}
          action={confirmState.action}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
          saving={saving}
        />
      )}
    </div>
  );
}