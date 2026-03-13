'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  AlertTriangle,
  Truck,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface POItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number; // already received in previous receivings
  unitPrice: number;
  total: number;
}

interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplierName: string;
  supplierEmail: string;
  status: string;
  items: POItem[];
  notes?: string;
  expectedDeliveryDate?: string;
  createdAt: string;
}

interface ReceivingItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantityExpected: number;
  quantityReceived: number;
  quantityDamaged: number;
  notes: string;
}

export default function ReceivePOPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const { branch } = useBranch();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [notes, setNotes] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPO();
  }, [id]);

  const fetchPO = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedPO: PurchaseOrder = data.purchaseOrder;
        setPo(fetchedPO);

        // Build receiving items from PO items — only items with remaining qty
        const items: ReceivingItem[] = fetchedPO.items.map((item) => {
          const alreadyReceived = item.quantityReceived || 0;
          const remaining = item.quantityOrdered - alreadyReceived;
          return {
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            quantityExpected: Math.max(remaining, 0),
            quantityReceived: Math.max(remaining, 0),
            quantityDamaged: 0,
            notes: '',
          };
        });

        setReceivingItems(items);
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

  const updateItem = (index: number, field: keyof ReceivingItem, value: any) => {
    setReceivingItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getItemStatus = (item: ReceivingItem) => {
    if (item.quantityDamaged > 0) return 'damaged';
    if (item.quantityReceived < item.quantityExpected) return 'short';
    if (item.quantityReceived > item.quantityExpected) return 'over';
    return 'ok';
  };

  const hasIssues = receivingItems.some(
    (item) =>
      item.quantityReceived !== item.quantityExpected || item.quantityDamaged > 0
  );

  const handleSubmit = async () => {
    const invalidItem = receivingItems.find(
      (item) => item.quantityReceived < 0 || item.quantityDamaged < 0
    );
    if (invalidItem) {
      toast.error('Quantities cannot be negative');
      return;
    }

    const allZero = receivingItems.every(
      (item) => item.quantityReceived === 0 && item.quantityDamaged === 0
    );
    if (allZero) {
      toast.error('Please enter received quantities for at least one item');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/po-receivings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: id,
          items: receivingItems,
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.hasIssues) {
          toast.success('Items received with issues — a resolution has been created');
        } else {
          toast.success('Items received successfully! Stock has been updated.');
        }
        router.push(`/${slug}/admin/purchase-orders/${id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to record receiving');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const totalExpected = receivingItems.reduce((s, i) => s + i.quantityExpected, 0);
  const totalReceived = receivingItems.reduce((s, i) => s + i.quantityReceived, 0);
  const totalDamaged = receivingItems.reduce((s, i) => s + i.quantityDamaged, 0);
  const goodStock = receivingItems.reduce(
    (s, i) => s + Math.max(i.quantityReceived - i.quantityDamaged, 0),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  if (!po) return null;

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/${slug}/admin/purchase-orders/${id}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-brand-orange mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to PO</span>
            </Link>
            <h1 className="text-3xl font-bold text-brand-black">Receive Items</h1>
            <p className="text-gray-600 mt-1">
              {po.orderNumber} · {po.supplierName}
            </p>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <Truck className="w-5 h-5 text-brand-orange" />
            <div>
              <p className="text-xs text-gray-500">Expected delivery</p>
              <p className="text-sm font-semibold text-gray-900">
                {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Expected', value: totalExpected, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Received', value: totalReceived, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Damaged', value: totalDamaged, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Added to Stock', value: goodStock, color: 'text-green-700', bg: 'bg-green-50' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-4 shadow-sm border border-gray-100`}>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Issues Banner */}
        {hasIssues && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Discrepancies detected</p>
              <p className="text-sm text-yellow-700">
                Some quantities differ from what was ordered or items are damaged. A resolution will be automatically created.
              </p>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Stock levels will be updated automatically based on <strong>Quantity Received minus Quantity Damaged</strong> for each item.
          </p>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-black">Items to Receive</h2>
            <span className="text-sm text-gray-500">{receivingItems.length} items</span>
          </div>

          <div className="divide-y divide-gray-100">
            {receivingItems.map((item, index) => {
              const status = getItemStatus(item);
              const netStock = Math.max(item.quantityReceived - item.quantityDamaged, 0);
              const isExpanded = expandedItems.has(index);

              return (
                <div key={index} className="p-5">
                  {/* Item Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          status === 'ok'
                            ? 'bg-green-100'
                            : status === 'damaged'
                            ? 'bg-red-100'
                            : status === 'short'
                            ? 'bg-yellow-100'
                            : 'bg-orange-100'
                        }`}
                      >
                        {status === 'ok' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              status === 'damaged'
                                ? 'text-red-600'
                                : status === 'short'
                                ? 'text-yellow-600'
                                : 'text-orange-600'
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-sm text-gray-500">{item.variantName}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(index)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Quantity Fields */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Expected
                      </label>
                      <div className="input-field bg-gray-50 text-gray-500 cursor-not-allowed">
                        {item.quantityExpected}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Received <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={`input-field ${
                          item.quantityReceived !== item.quantityExpected
                            ? 'border-yellow-400 focus:border-yellow-500 focus:ring-yellow-200'
                            : ''
                        }`}
                        value={item.quantityReceived}
                        onChange={(e) =>
                          updateItem(index, 'quantityReceived', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Damaged
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantityReceived}
                        className={`input-field ${
                          item.quantityDamaged > 0
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : ''
                        }`}
                        value={item.quantityDamaged}
                        onChange={(e) =>
                          updateItem(index, 'quantityDamaged', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>

                  {/* Net Stock Added */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        Net added to stock:{' '}
                        <span
                          className={`font-semibold ${
                            netStock > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {netStock} units
                        </span>
                      </span>
                    </div>

                    {(status !== 'ok') && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          status === 'damaged'
                            ? 'bg-red-100 text-red-700'
                            : status === 'short'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {status === 'damaged'
                          ? 'Damaged items'
                          : status === 'short'
                          ? `${item.quantityExpected - item.quantityReceived} short`
                          : `${item.quantityReceived - item.quantityExpected} over`}
                      </span>
                    )}
                  </div>

                  {/* Expandable Notes */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Item Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. 3 boxes crushed, items missing from carton..."
                        className="input-field text-sm"
                        value={item.notes}
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* General Notes */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-brand-black mb-4">Receiving Notes</h2>
          <textarea
            rows={3}
            placeholder="Any general notes about this receiving (e.g. delivery was late, driver details, etc.)..."
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${slug}/admin/purchase-orders/${id}`}
            className="btn-secondary"
          >
            Cancel
          </Link>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Recording...' : 'Confirm Receiving'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}