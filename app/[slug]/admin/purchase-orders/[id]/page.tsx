'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  Calendar,
  Package,
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Edit
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

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

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const { branch } = useBranch();
  
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPO();
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
    } catch (error) {
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Purchase Order Not Found</h1>
          <Link href={`/${slug}/admin/purchase-orders`} className="btn-primary">
            Back to Purchase Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen Version */}
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header Actions */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href={`/${slug}/admin/purchase-orders`}
              className="flex items-center space-x-2 text-gray-600 hover:text-brand-orange"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Purchase Orders</span>
            </Link>

            <div className="flex items-center space-x-3">
              {po.status === 'draft' && (
                <>
                  <Link
                    href={`/${slug}/admin/purchase-orders/${id}/edit`}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Edit className="w-5 h-5" />
                    <span>Edit</span>
                  </Link>
                  <button
                    onClick={() => handleStatusUpdate('pending_approval')}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Send className="w-5 h-5" />
                    <span>Submit for Approval</span>
                  </button>
                </>
              )}

              {po.status === 'pending_approval' && (
                <button
                  onClick={() => handleStatusUpdate('confirmed')}
                  className="btn-primary flex items-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Approve</span>
                </button>
              )}

              {po.status === 'confirmed' && (
                <button
                  onClick={() => handleStatusUpdate('sent')}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Mark as Sent</span>
                </button>
              )}

              {(po.status === 'sent' || po.status === 'partially_received') && (
                <Link
                  href={`/${slug}/admin/purchase-orders/${id}/receive`}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Truck className="w-5 h-5" />
                  <span>Receive Items</span>
                </Link>
              )}

              <button
                onClick={handlePrint}
                className="btn-secondary flex items-center space-x-2"
              >
                <Printer className="w-5 h-5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* PO Content */}
          <div ref={printRef} className="bg-white rounded-2xl shadow-sm p-8">
            {/* Header */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-brand-black mb-2">
                    Purchase Order
                  </h1>
                  <p className="text-xl text-gray-600">{po.orderNumber}</p>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <img src="/logo.png" alt="TFS" className="h-12 ml-auto" />
                  </div>
                  <p className="font-semibold text-brand-black">{branch?.displayName || 'TFS Wholesalers'}</p>
                  {/* ✅ FIXED: Use nested settings properties */}
                  <p className="text-sm text-gray-600">{branch?.settings?.storeLocation?.address}</p>
                  <p className="text-sm text-gray-600">{branch?.settings?.contactPhone}</p>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Supplier Details */}
              <div>
                <h2 className="font-semibold text-brand-black mb-3">Supplier</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-semibold text-gray-900">{po.supplierName}</p>
                  <p className="text-sm text-gray-600">{po.supplierEmail}</p>
                  {po.supplierPhone && (
                    <p className="text-sm text-gray-600">{po.supplierPhone}</p>
                  )}
                </div>
              </div>

              {/* Order Details */}
              <div>
                <h2 className="font-semibold text-brand-black mb-3">Order Details</h2>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                      {po.status.replace('_', ' ')}
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
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Qty Ordered</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {po.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-sm text-gray-600">{item.variantName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.sku}</td>
                        <td className="px-4 py-3 text-right font-medium">{item.quantityOrdered}</td>
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
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(po.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-semibold">{formatCurrency(po.tax)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-lg font-bold text-brand-black">Total:</span>
                  <span className="text-lg font-bold text-brand-orange">{formatCurrency(po.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {po.notes && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="font-semibold text-brand-black mb-2">Notes</h2>
                <p className="text-gray-600">{po.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Version */}
      <div className="hidden print:block p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">Purchase Order</h1>
              <p className="text-lg">{po.orderNumber}</p>
            </div>
            <div className="text-right">
              <img src="/logo.png" alt="TFS" className="h-10 ml-auto mb-2" />
              <p className="font-semibold">{branch?.displayName || 'TFS Wholesalers'}</p>
              {/* ✅ FIXED: Use nested settings properties */}
              <p className="text-xs">{branch?.settings?.storeLocation?.address}</p>
              {branch?.settings?.contactPhone && <p className="text-xs">{branch?.settings?.contactPhone}</p>}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="font-semibold mb-2">Supplier</h2>
              <p className="font-semibold">{po.supplierName}</p>
              <p className="text-sm">{po.supplierEmail}</p>
              {po.supplierPhone && <p className="text-sm">{po.supplierPhone}</p>}
            </div>
            <div>
              <h2 className="font-semibold mb-2">Order Details</h2>
              <p className="text-sm">Status: <span className="font-semibold">{po.status.replace('_', ' ')}</span></p>
              <p className="text-sm">Created: {formatDate(po.createdAt)}</p>
              {po.expectedDeliveryDate && (
                <p className="text-sm">Expected: {formatDate(po.expectedDeliveryDate)}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-900">
              <tr>
                <th className="py-2 text-left font-semibold">Product</th>
                <th className="py-2 text-left font-semibold">SKU</th>
                <th className="py-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Price</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2">
                    {item.productName}
                    {item.variantName && <span className="text-sm"> - {item.variantName}</span>}
                  </td>
                  <td className="py-2 text-sm">{item.sku}</td>
                  <td className="py-2 text-right">{item.quantityOrdered}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>VAT (15%):</span>
                <span className="font-semibold">{formatCurrency(po.tax)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-900">
                <span className="font-bold">Total:</span>
                <span className="font-bold">{formatCurrency(po.total)}</span>
              </div>
            </div>
          </div>

          {po.notes && (
            <div className="mb-8">
              <h2 className="font-semibold mb-2">Notes</h2>
              <p className="text-sm">{po.notes}</p>
            </div>
          )}

          <div className="text-center text-xs text-gray-600 pt-8 border-t">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </>
  );
}