'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Package,
  Wrench,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Truck,
  CreditCard,
  RefreshCw,
  RotateCcw,
  FileText,
  User,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface Resolution {
  _id: string;
  purchaseOrderId: string;
  orderNumber: string;
  branchId: string;
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
  resolvedAt?: string;
}

// Resolution actions per type
const RESOLUTION_ACTIONS: Record<string, { id: string; label: string; description: string; icon: any; color: string }[]> = {
  damaged: [
    {
      id: 'supplier_credit',
      label: 'Request Supplier Credit',
      description: 'Contact supplier to issue a credit note for damaged goods',
      icon: CreditCard,
      color: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      id: 'replacement_requested',
      label: 'Request Replacement',
      description: 'Ask supplier to replace the damaged items on next delivery',
      icon: RefreshCw,
      color: 'border-green-200 bg-green-50 text-green-700',
    },
    {
      id: 'written_off',
      label: 'Write Off as Loss',
      description: 'Write off the damaged items and absorb the cost',
      icon: FileText,
      color: 'border-gray-200 bg-gray-50 text-gray-700',
    },
    {
      id: 'returned_to_supplier',
      label: 'Return to Supplier',
      description: 'Arrange pickup/return of damaged items to supplier',
      icon: Truck,
      color: 'border-orange-200 bg-orange-50 text-orange-700',
    },
  ],
  missing: [
    {
      id: 'backorder_created',
      label: 'Place on Backorder',
      description: 'Request missing items be delivered on next scheduled delivery',
      icon: Clock,
      color: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    },
    {
      id: 'supplier_credit',
      label: 'Request Supplier Credit',
      description: 'Credit note for items paid for but not received',
      icon: CreditCard,
      color: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      id: 'emergency_reorder',
      label: 'Emergency Reorder',
      description: 'Create a new urgent purchase order for missing items',
      icon: RefreshCw,
      color: 'border-red-200 bg-red-50 text-red-700',
    },
    {
      id: 'written_off',
      label: 'Accept Short Delivery',
      description: 'Accept the short delivery and adjust stock accordingly',
      icon: CheckCircle,
      color: 'border-gray-200 bg-gray-50 text-gray-700',
    },
  ],
  over_delivered: [
    {
      id: 'keep_and_pay',
      label: 'Keep & Pay for Extra',
      description: 'Accept the extra stock and arrange payment with supplier',
      icon: CreditCard,
      color: 'border-green-200 bg-green-50 text-green-700',
    },
    {
      id: 'return_extra',
      label: 'Return Extra Items',
      description: 'Arrange collection of over-delivered items by supplier',
      icon: RotateCcw,
      color: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
      id: 'keep_as_goodwill',
      label: 'Keep as Goodwill',
      description: 'Supplier agrees to leave extra items at no charge',
      icon: Package,
      color: 'border-blue-200 bg-blue-50 text-blue-700',
    },
  ],
  wrong_item: [
    {
      id: 'returned_to_supplier',
      label: 'Return Wrong Items',
      description: 'Return wrong items and request correct ones be sent',
      icon: Truck,
      color: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
      id: 'replacement_requested',
      label: 'Request Correct Items',
      description: 'Keep wrong items temporarily and request correct ones urgently',
      icon: RefreshCw,
      color: 'border-green-200 bg-green-50 text-green-700',
    },
    {
      id: 'supplier_credit',
      label: 'Refuse & Request Credit',
      description: 'Refuse wrong items and get a credit note from supplier',
      icon: CreditCard,
      color: 'border-blue-200 bg-blue-50 text-blue-700',
    },
  ],
  quality_issue: [
    {
      id: 'supplier_credit',
      label: 'Request Supplier Credit',
      description: 'Credit note for substandard quality items',
      icon: CreditCard,
      color: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      id: 'returned_to_supplier',
      label: 'Return to Supplier',
      description: 'Return all affected items and request refund or replacement',
      icon: Truck,
      color: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
      id: 'partial_credit',
      label: 'Negotiate Partial Credit',
      description: 'Keep items at a discounted rate agreed with supplier',
      icon: FileText,
      color: 'border-gray-200 bg-gray-50 text-gray-700',
    },
  ],
};

const TYPE_CONFIG = {
  damaged: { label: 'Damaged Goods', icon: Wrench, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  missing: { label: 'Missing / Short Delivery', icon: TrendingDown, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  over_delivered: { label: 'Over Delivered', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  wrong_item: { label: 'Wrong Item Received', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  quality_issue: { label: 'Quality Issue', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const PRIORITY_COLOR = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export default function ResolutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const { branch } = useBranch();

  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Action flow state
  const [step, setStep] = useState<'view' | 'action' | 'confirm'>('view');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [adjustStock, setAdjustStock] = useState(false);

  useEffect(() => {
    fetchResolution();
  }, [id]);

  const fetchResolution = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/order-resolutions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setResolution(data.resolution);
      } else {
        toast.error('Resolution not found');
        router.push(`/${slug}/admin/resolutions`);
      }
    } catch {
      toast.error('Failed to load resolution');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAction = () => {
    setStep('action');
  };

  const handleSelectAction = (actionId: string) => {
    setSelectedAction(actionId);
    setStep('confirm');
  };

  const handleResolve = async () => {
    if (!selectedAction) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/order-resolutions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolutionAction: selectedAction,
          resolution: resolutionNotes,
          adjustStock,
        }),
      });

      if (res.ok) {
        toast.success('Resolution completed successfully');
        fetchResolution();
        setStep('view');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to resolve');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/order-resolutions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success('Status updated');
        fetchResolution();
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  if (!resolution) return null;

  const typeConf = TYPE_CONFIG[resolution.type];
  const statusConf = STATUS_CONFIG[resolution.status];
  const actions = RESOLUTION_ACTIONS[resolution.type] || [];
  const TypeIcon = typeConf.icon;
  const StatusIcon = statusConf.icon;
  const selectedActionConf = actions.find((a) => a.id === selectedAction);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <Link
          href={`/${slug}/admin/resolutions`}
          className="flex items-center space-x-2 text-gray-600 hover:text-brand-orange mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Resolutions</span>
        </Link>

        {/* ── STEP: VIEW ── */}
        {step === 'view' && (
          <>
            {/* Header Card */}
            <div className={`bg-white border ${typeConf.border} rounded-2xl p-6 mb-5`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-xl ${typeConf.bg} flex items-center justify-center flex-shrink-0`}>
                    <TypeIcon className={`w-6 h-6 ${typeConf.color}`} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-brand-black">{typeConf.label}</h1>
                    <div className="flex items-center space-x-2 mt-1">
                      <Link
                        href={`/${slug}/admin/purchase-orders/${resolution.purchaseOrderId}`}
                        className="text-sm text-brand-orange hover:underline font-medium"
                      >
                        {resolution.orderNumber}
                      </Link>
                      <span className="text-gray-300">·</span>
                      <span className="text-sm text-gray-500">{formatDate(resolution.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusConf.label}</span>
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLOR[resolution.priority]}`}>
                    {resolution.priority} priority
                  </span>
                </div>
              </div>

              <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 rounded-lg p-3">
                {resolution.description}
              </p>
            </div>

            {/* Affected Items */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-brand-black">Affected Items</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {resolution.affectedItems.map((item, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                        {item.variantId && (
                          <p className="text-xs text-gray-500">Variant ID: {item.variantId}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${typeConf.bg} ${typeConf.color}`}>
                      ×{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolved state */}
            {resolution.status === 'resolved' && (resolution.resolutionAction || resolution.resolution) && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-800 mb-1">Resolution Applied</p>
                    {resolution.resolutionAction && (
                      <p className="text-sm text-green-700 mb-1">
                        Action: <span className="font-medium">{resolution.resolutionAction.replace(/_/g, ' ')}</span>
                      </p>
                    )}
                    {resolution.resolution && (
                      <p className="text-sm text-green-700">{resolution.resolution}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {resolution.status !== 'resolved' && resolution.status !== 'cancelled' && (
              <div className="flex items-center justify-between gap-3">
                {resolution.status === 'open' && (
                  <button
                    onClick={() => handleUpdateStatus('in_progress')}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Mark In Progress</span>
                  </button>
                )}
                <div className="flex items-center space-x-3 ml-auto">
                  <button
                    onClick={() => handleUpdateStatus('cancelled')}
                    className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartAction}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <span>Resolve This Issue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP: CHOOSE ACTION ── */}
        {step === 'action' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-5">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-10 h-10 rounded-xl ${typeConf.bg} flex items-center justify-center`}>
                  <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-brand-black">Choose a Resolution</h2>
                  <p className="text-sm text-gray-500">{resolution.orderNumber} · {typeConf.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {actions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleSelectAction(action.id)}
                    className={`w-full text-left border-2 rounded-2xl p-5 transition-all hover:shadow-md ${action.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-4">
                        <ActionIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{action.label}</p>
                          <p className="text-sm opacity-75 mt-0.5">{action.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('view')}
              className="btn-secondary"
            >
              ← Back
            </button>
          </>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'confirm' && selectedActionConf && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-5">
              <h2 className="text-xl font-bold text-brand-black mb-1">Confirm Resolution</h2>
              <p className="text-sm text-gray-500">Review and confirm your resolution action</p>
            </div>

            {/* Selected Action Summary */}
            <div className={`border-2 rounded-2xl p-5 mb-5 ${selectedActionConf.color}`}>
              <div className="flex items-start space-x-3">
                <selectedActionConf.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{selectedActionConf.label}</p>
                  <p className="text-sm opacity-75 mt-0.5">{selectedActionConf.description}</p>
                </div>
              </div>
            </div>

            {/* Affected Items Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h3 className="font-semibold text-brand-black mb-3">Items Affected</h3>
              <div className="space-y-2">
                {resolution.affectedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.productName}</span>
                    <span className="font-semibold text-gray-900">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Over-delivered: stock adjustment option */}
            {(resolution.type === 'over_delivered' && selectedAction === 'keep_and_pay') && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustStock}
                    onChange={(e) => setAdjustStock(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-brand-orange rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Add extra items to stock</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      The over-delivered quantities will be added to your stock levels
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Return to supplier: remove from stock */}
            {(selectedAction === 'return_extra' || selectedAction === 'returned_to_supplier') && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustStock}
                    onChange={(e) => setAdjustStock(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-brand-orange rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Remove returned items from stock</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Deduct the returned quantities from your current stock levels
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <label className="block text-sm font-semibold text-brand-black mb-2">
                Resolution Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Spoke to John at supplier — credit note #CN-2024-001 issued, will arrive Friday..."
                className="input-field text-sm"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('action')}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                onClick={handleResolve}
                disabled={saving}
                className="btn-primary flex items-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{saving ? 'Resolving...' : 'Confirm & Resolve'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}