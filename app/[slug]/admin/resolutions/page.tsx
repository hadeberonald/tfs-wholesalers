'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Wrench,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface Resolution {
  _id: string;
  purchaseOrderId: string;
  orderNumber: string;
  type: 'damaged' | 'missing' | 'over_delivered' | 'wrong_item' | 'quality_issue';
  description: string;
  affectedItems: {
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
  }[];
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  resolution?: string;
  resolutionAction?: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_CONFIG = {
  damaged: {
    label: 'Damaged',
    icon: Wrench,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  missing: {
    label: 'Missing / Short',
    icon: TrendingDown,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  over_delivered: {
    label: 'Over Delivered',
    icon: TrendingUp,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  wrong_item: {
    label: 'Wrong Item',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  quality_issue: {
    label: 'Quality Issue',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
};

const STATUS_CONFIG = {
  open: { label: 'Open', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', icon: ArrowUpCircle, color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-100 text-gray-500' },
};

const PRIORITY_CONFIG = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export default function ResolutionsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();

  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!branchLoading && branch) fetchResolutions();
  }, [branchLoading, branch, statusFilter, typeFilter]);

  const fetchResolutions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ all: 'true' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/order-resolutions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResolutions(data.resolutions || []);
      } else {
        toast.error('Failed to load resolutions');
      }
    } catch {
      toast.error('Failed to load resolutions');
    } finally {
      setLoading(false);
    }
  };

  const filtered = resolutions.filter(
    (r) =>
      r.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.affectedItems.some((i) =>
        i.productName.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const stats = {
    open: resolutions.filter((r) => r.status === 'open').length,
    in_progress: resolutions.filter((r) => r.status === 'in_progress').length,
    high: resolutions.filter((r) => r.priority === 'high' && r.status !== 'resolved').length,
    resolved: resolutions.filter((r) => r.status === 'resolved').length,
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">Order Resolutions</h1>
          <p className="text-gray-600">Manage delivery discrepancies for {branch?.displayName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Open', value: stats.open, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'High Priority', value: stats.high, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number or product..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input-field w-full sm:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="input-field w-full sm:w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="damaged">Damaged</option>
            <option value="missing">Missing / Short</option>
            <option value="over_delivered">Over Delivered</option>
            <option value="wrong_item">Wrong Item</option>
            <option value="quality_issue">Quality Issue</option>
          </select>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No resolutions found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try a different search term' : 'All delivery discrepancies will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((resolution) => {
              const typeConf = TYPE_CONFIG[resolution.type] || TYPE_CONFIG.damaged;
              const statusConf = STATUS_CONFIG[resolution.status];
              const TypeIcon = typeConf.icon;
              const StatusIcon = statusConf.icon;

              return (
                <Link
                  key={resolution._id}
                  href={`/${slug}/admin/resolutions/${resolution._id}`}
                  className={`block bg-white border ${typeConf.border} rounded-2xl p-5 hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${typeConf.bg} flex items-center justify-center flex-shrink-0`}>
                        <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{resolution.orderNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConf.badge}`}>
                            {typeConf.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_CONFIG[resolution.priority]}`}>
                            {resolution.priority} priority
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 truncate">{resolution.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {resolution.affectedItems.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item.productName} ×{item.quantity}
                            </span>
                          ))}
                          {resolution.affectedItems.length > 3 && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              +{resolution.affectedItems.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusConf.label}</span>
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(resolution.createdAt)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}