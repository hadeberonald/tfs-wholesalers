'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Edit,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface POResolution {
  _id: string;
  type: 'damaged' | 'missing' | 'over_delivered' | 'wrong_item' | 'quality_issue';
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  resolutionAction?: string;
  affectedItems: { productName: string; quantity: number }[];
  priority: string;
  createdAt: string;
}

interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    sku: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes?: string;
  expectedDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  sentAt?: string;
  receivedAt?: string;
}

const RESOLUTION_ACTION_LABELS: Record<string, string> = {
  supplier_credit: 'Supplier Credit Issued',
  replacement_requested: 'Replacement Requested',
  written_off: 'Written Off',
  returned_to_supplier: 'Returned to Supplier',
  backorder_created: 'Placed on Backorder',
  emergency_reorder: 'Emergency Reorder',
  keep_and_pay: 'Keeping Extra — Payment Required',
  return_extra: 'Returning Extra Items',
  keep_as_goodwill: 'Kept as Goodwill',
  partial_credit: 'Partial Credit Negotiated',
};

const RESOLUTION_PRICE_EFFECT: Record<string, 'reduce' | 'increase' | 'none'> = {
  supplier_credit: 'reduce',
  partial_credit: 'reduce',
  written_off: 'reduce',
  keep_and_pay: 'increase',
  returned_to_supplier: 'none',
  return_extra: 'none',
  replacement_requested: 'none',
  backorder_created: 'none',
  emergency_reorder: 'none',
  keep_as_goodwill: 'none',
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const { branch } = useBranch();
  
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [resolutions, setResolutions] = useState<POResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'resolutions'>('details');

  useEffect(() => {
    fetchPO();
    fetchResolutions();
  }, [id]);

  const fetchPO = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPo(data.purchaseOrder);
      } else {
        toast.error('Purchase order not found');
        router.push(`/${slug}/admin/purchase-orders`);
      }
    } catch {
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const fetchResolutions = async () => {
    try {
      const res = await fetch(`/api/order-resolutions?purchaseOrderId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setResolutions(data.resolutions || []);
      }
    } catch {
      console.error('Failed to fetch resolutions');
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success('Status updated');
        fetchPO();
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  // Calculate adjusted total after resolutions
  const getAdjustedTotal = () => {
    if (!po) return { original: 0, adjusted: 0, difference: 0, hasAdjustment: false };

    const resolvedResolutions = resolutions.filter((r) => r.status === 'resolved' && r.resolutionAction);
    if (resolvedResolutions.length === 0) {
      return { original: po.total, adjusted: po.total, difference: 0, hasAdjustment: false };
    }

    // Simplified: for each resolved resolution, estimate impact
    // In a real system you'd store the exact monetary adjustment
    let adjustment = 0;
    resolvedResolutions.forEach((r) => {
      const effect = RESOLUTION_PRICE_EFFECT[r.resolutionAction || ''];
      if (effect === 'reduce') {
        // Estimate: affected items * unit impact (rough)
        const totalAffectedQty = r.affectedItems.reduce((s, i) => s + i.quantity, 0);
        // Use average unit price from PO
        const avgUnitPrice = po.items.length > 0
          ? po.subtotal / po.items.reduce((s, i) => s + i.quantityOrdered, 0)
          : 0;
        adjustment -= totalAffectedQty * avgUnitPrice * 1.15; // incl VAT
      } else if (effect === 'increase') {
        const totalAffectedQty = r.affectedItems.reduce((s, i) => s + i.quantity, 0);
        const avgUnitPrice = po.items.length > 0
          ? po.subtotal / po.items.reduce((s, i) => s + i.quantityOrdered, 0)
          : 0;
        adjustment += totalAffectedQty * avgUnitPrice * 1.15;
      }
    });

    const adjusted = Math.max(po.total + adjustment, 0);
    return {
      original: po.total,
      adjusted,
      difference: adjustment,
      hasAdjustment: adjustment !== 0,
    };
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', { month: 'long', day: 'numeric', year: 'numeric' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'partially_received': return 'bg-orange-100 text-orange-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResolutionTypeLabel = (type: string) => ({
    damaged: 'Damaged Goods',
    missing: 'Missing / Short',
    over_delivered: 'Over Delivered',
    wrong_item: 'Wrong Item',
    quality_issue: 'Quality Issue',
  }[type] || type);

  const getResolutionTypeColor = (type: string) => ({
    damaged: 'bg-red-100 text-red-700',
    missing: 'bg-yellow-100 text-yellow-700',
    over_delivered: 'bg-blue-100 text-blue-700',
    wrong_item: 'bg-purple-100 text-purple-700',
    quality_issue: 'bg-orange-100 text-orange-700',
  }[type] || 'bg-gray-100 text-gray-700');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  if (!po) return null;

  const { original, adjusted, difference, hasAdjustment } = getAdjustedTotal();
  const openResolutions = resolutions.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const resolvedResolutions = resolutions.filter((r) => r.status === 'resolved');

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href={`/${slug}/admin/purchase-orders`} className="flex items-center space-x-2 text-gray-600 hover:text-brand-orange">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Purchase Orders</span>
          </Link>

          <div className="flex items-center space-x-2">
            {po.status === 'draft' && (
              <>
                <Link href={`/${slug}/admin/purchase-orders/${id}/edit`} className="btn-secondary flex items-center space-x-2">
                  <Edit className="w-4 h-4" /><span>Edit</span>
                </Link>
                <button onClick={() => handleStatusUpdate('pending_approval')} className="btn-primary flex items-center space-x-2">
                  <Send className="w-4 h-4" /><span>Submit for Approval</span>
                </button>
              </>
            )}
            {po.status === 'pending_approval' && (
              <button onClick={() => handleStatusUpdate('confirmed')} className="btn-primary flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" /><span>Approve</span>
              </button>
            )}
            {po.status === 'confirmed' && (
              <button onClick={() => handleStatusUpdate('sent')} className="btn-primary flex items-center space-x-2">
                <Send className="w-4 h-4" /><span>Mark as Sent</span>
              </button>
            )}
            {(po.status === 'sent' || po.status === 'partially_received') && (
              <Link href={`/${slug}/admin/purchase-orders/${id}/receive`} className="btn-primary flex items-center space-x-2">
                <Truck className="w-4 h-4" /><span>Receive Items</span>
              </Link>
            )}
            <button onClick={() => window.print()} className="btn-secondary flex items-center space-x-2">
              <Printer className="w-4 h-4" /><span>Print</span>
            </button>
          </div>
        </div>

        {/* Unresolved alerts */}
        {openResolutions.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800">
                  {openResolutions.length} unresolved issue{openResolutions.length !== 1 ? 's' : ''} on this PO
                </p>
                <p className="text-sm text-yellow-700">These may affect the final amount owed to the supplier</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('resolutions')} className="text-sm text-yellow-700 font-medium hover:underline flex-shrink-0 ml-4">
              View Issues →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-white rounded-xl p-1 shadow-sm mb-6 border border-gray-100">
          {[
            { id: 'details', label: 'PO Details', icon: FileText },
            { 
              id: 'resolutions', 
              label: `Resolutions${resolutions.length > 0 ? ` (${resolutions.length})` : ''}`, 
              icon: AlertTriangle,
              alert: openResolutions.length > 0,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-orange text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.alert && activeTab !== tab.id && (
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: DETAILS ── */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {/* PO Header */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-brand-black mb-1">Purchase Order</h1>
                  <p className="text-xl text-gray-600">{po.orderNumber}</p>
                </div>
                <div className="text-right">
                  <img src="/logo.png" alt="TFS" className="h-12 ml-auto mb-2" />
                  <p className="font-semibold text-brand-black">{branch?.displayName || 'TFS Wholesalers'}</p>
                  <p className="text-sm text-gray-600">{branch?.settings?.storeLocation?.address}</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h2 className="font-semibold text-brand-black mb-3">Supplier</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-semibold text-gray-900">{po.supplierName}</p>
                  <p className="text-sm text-gray-600">{po.supplierEmail}</p>
                  {po.supplierPhone && <p className="text-sm text-gray-600">{po.supplierPhone}</p>}
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-brand-black mb-3">Order Details</h2>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                      {po.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="text-sm font-medium">{formatDate(po.createdAt)}</span>
                  </div>
                  {po.expectedDeliveryDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Expected:</span>
                      <span className="text-sm font-medium">{formatDate(po.expectedDeliveryDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <h2 className="font-semibold text-brand-black mb-3">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">SKU</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Ordered</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Received</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {po.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.variantName && <p className="text-sm text-gray-600">{item.variantName}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.sku}</td>
                        <td className="px-4 py-3 text-right">{item.quantityOrdered}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={item.quantityReceived < item.quantityOrdered ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                            {item.quantityReceived || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full md:w-1/2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(po.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-semibold">{formatCurrency(po.tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-lg font-bold text-brand-black">Original Total:</span>
                  <span className="text-lg font-bold">{formatCurrency(original)}</span>
                </div>
                {hasAdjustment && (
                  <>
                    <div className={`flex justify-between ${difference < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="font-medium flex items-center space-x-1">
                        {difference < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        <span>Resolution Adjustment:</span>
                      </span>
                      <span className="font-semibold">
                        {difference < 0 ? '-' : '+'}{formatCurrency(Math.abs(difference))}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-brand-orange/30 bg-orange-50 -mx-2 px-2 rounded">
                      <span className="text-lg font-bold text-brand-orange">Adjusted Total:</span>
                      <span className="text-lg font-bold text-brand-orange">{formatCurrency(adjusted)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {po.notes && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="font-semibold text-brand-black mb-2">Notes</h2>
                <p className="text-gray-600">{po.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: RESOLUTIONS ── */}
        {activeTab === 'resolutions' && (
          <div className="space-y-4">
            {resolutions.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Issues</h3>
                <p className="text-gray-500">This PO has no delivery discrepancies recorded.</p>
              </div>
            ) : (
              <>
                {resolutions.map((resolution) => (
                  <div
                    key={resolution._id}
                    className={`bg-white rounded-2xl p-5 border-l-4 ${
                      resolution.status === 'resolved'
                        ? 'border-green-400'
                        : resolution.priority === 'high'
                        ? 'border-red-400'
                        : 'border-yellow-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getResolutionTypeColor(resolution.type)}`}>
                            {getResolutionTypeLabel(resolution.type)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            resolution.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            resolution.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {resolution.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{resolution.description}</p>
                      </div>
                      <Link
                        href={`/${slug}/admin/resolutions/${resolution._id}`}
                        className="text-sm text-brand-orange hover:underline flex items-center space-x-1 flex-shrink-0 ml-4"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Affected items */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {resolution.affectedItems.map((item, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.productName} ×{item.quantity}
                        </span>
                      ))}
                    </div>

                    {/* Resolution action achieved */}
                    {resolution.status === 'resolved' && resolution.resolutionAction && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">
                            Resolution: {RESOLUTION_ACTION_LABELS[resolution.resolutionAction] || resolution.resolutionAction.replace(/_/g, ' ')}
                          </p>
                          {RESOLUTION_PRICE_EFFECT[resolution.resolutionAction] !== 'none' && (
                            <p className="text-xs text-green-700 mt-0.5">
                              {RESOLUTION_PRICE_EFFECT[resolution.resolutionAction] === 'reduce'
                                ? '↓ Total amount has been reduced'
                                : '↑ Total amount has been increased'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Adjusted total summary */}
                {hasAdjustment && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <h3 className="font-bold text-brand-black mb-3 flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-brand-orange" />
                      <span>Price Impact Summary</span>
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Original PO Total</span>
                        <span className="font-semibold">{formatCurrency(original)}</span>
                      </div>
                      <div className={`flex justify-between text-sm ${difference < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>Resolution Adjustment</span>
                        <span className="font-semibold">
                          {difference < 0 ? '-' : '+'}{formatCurrency(Math.abs(difference))}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-orange-200">
                        <span className="font-bold text-brand-black">Adjusted Total</span>
                        <span className="font-bold text-brand-orange text-lg">{formatCurrency(adjusted)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}