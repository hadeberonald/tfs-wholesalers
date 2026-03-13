'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  CreditCard,
  Building,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WithdrawalRequest {
  _id: string;
  branchId: string;
  branchName?: string;
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
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function SuperAdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/withdrawals');
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch {
      toast.error('Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/super-admin/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', adminNotes: adminNotes[id] || '' }),
      });
      if (res.ok) {
        toast.success('Withdrawal approved');
        fetchWithdrawals();
      } else {
        toast.error('Failed to approve');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcess = async (id: string) => {
    const w = withdrawals.find((x) => x._id === id);
    if (!w) return;

    if (!confirm(`Process Paystack transfer of R${w.amount} to ${w.bankDetails.accountName}?`)) return;

    setProcessingId(id);
    try {
      const res = await fetch(`/api/super-admin/withdrawals/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Transfer initiated via Paystack!');
        fetchWithdrawals();
      } else {
        toast.error(data.error || 'Transfer failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessingId(id);
    try {
      const res = await fetch(`/api/super-admin/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', adminNotes: reason }),
      });
      if (res.ok) {
        toast.success('Withdrawal rejected');
        fetchWithdrawals();
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const pending = withdrawals.filter((w) => w.status === 'pending');
  const approved = withdrawals.filter((w) => w.status === 'approved');
  const others = withdrawals.filter((w) => !['pending', 'approved'].includes(w.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  const renderRequest = (w: WithdrawalRequest) => {
    const conf = STATUS_CONFIG[w.status];
    const StatusIcon = conf.icon;
    const isProcessing = processingId === w._id;

    return (
      <div key={w._id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${
        w.status === 'pending' ? 'border-yellow-400' :
        w.status === 'approved' ? 'border-blue-400' :
        w.status === 'completed' ? 'border-green-400' :
        w.status === 'rejected' ? 'border-red-400' : 'border-gray-300'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <p className="text-2xl font-bold text-brand-black">{formatCurrency(w.amount)}</p>
              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${conf.color}`}>
                <StatusIcon className="w-3 h-3" />
                <span>{conf.label}</span>
              </span>
            </div>
            {w.branchName && <p className="text-sm font-medium text-gray-700">{w.branchName}</p>}
            <p className="text-xs text-gray-500">{formatDate(w.requestedAt)}</p>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2 mb-1">
            <Building className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{w.bankDetails.accountName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{w.bankDetails.bankName} · {w.bankDetails.accountNumber}</span>
          </div>
        </div>

        {w.notes && <p className="text-sm text-gray-600 mb-3 italic">"{w.notes}"</p>}
        {w.adminNotes && (
          <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg mb-3">
            Admin note: {w.adminNotes}
          </p>
        )}
        {w.paystackReference && (
          <p className="text-xs text-gray-400 font-mono mb-3">Ref: {w.paystackReference}</p>
        )}

        {/* Actions */}
        {w.status === 'pending' && (
          <div className="space-y-2">
            <textarea
              placeholder="Admin notes (optional)..."
              className="input-field text-sm"
              rows={2}
              value={adminNotes[w._id] || ''}
              onChange={(e) => setAdminNotes((prev) => ({ ...prev, [w._id]: e.target.value }))}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => handleApprove(w._id)}
                disabled={isProcessing}
                className="flex-1 btn-primary text-sm flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isProcessing ? 'Processing...' : 'Approve'}</span>
              </button>
              <button
                onClick={() => handleReject(w._id)}
                disabled={isProcessing}
                className="flex-1 btn-secondary text-red-600 border-red-200 hover:bg-red-50 text-sm flex items-center justify-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        )}

        {w.status === 'approved' && (
          <button
            onClick={() => handleProcess(w._id)}
            disabled={isProcessing}
            className="w-full btn-primary text-sm flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /><span>Processing Paystack Transfer...</span></>
            ) : (
              <><Send className="w-4 h-4" /><span>Send via Paystack Transfer</span></>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">Withdrawal Requests</h1>
          <p className="text-gray-600">Review and process branch withdrawal requests</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{pending.length}</p>
            <p className="text-sm text-yellow-600">Pending Review</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{approved.length}</p>
            <p className="text-sm text-blue-600">Approved / Ready</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{others.length}</p>
            <p className="text-sm text-gray-500">Processed</p>
          </div>
        </div>

        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">No withdrawal requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending Review</h2>
                <div className="space-y-3">{pending.map(renderRequest)}</div>
              </div>
            )}
            {approved.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Approved — Ready to Transfer</h2>
                <div className="space-y-3">{approved.map(renderRequest)}</div>
              </div>
            )}
            {others.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">History</h2>
                <div className="space-y-3">{others.map(renderRequest)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}