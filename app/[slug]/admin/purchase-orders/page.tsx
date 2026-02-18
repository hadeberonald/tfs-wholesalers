'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Plus, 
  FileText, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle,
  Send,
  Truck,
  Edit,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplierName: string;
  supplierEmail: string;
  total: number;
  status: string;
  expectedDeliveryDate?: string;
  createdAt: string;
  items: any[];
}

export default function PurchaseOrdersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchPurchaseOrders();
    }
  }, [branchLoading, branch, statusFilter]);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/purchase-orders?all=true'
        : `/api/purchase-orders?status=${statusFilter}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPurchaseOrders(data.purchaseOrders || []);
      } else {
        toast.error('Failed to load purchase orders');
      }
    } catch (error) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success('Status updated');
        fetchPurchaseOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Purchase order deleted');
        fetchPurchaseOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'sent':
        return 'bg-purple-100 text-purple-800';
      case 'partially_received':
        return 'bg-orange-100 text-orange-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="w-4 h-4" />;
      case 'pending_approval':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'sent':
        return <Send className="w-4 h-4" />;
      case 'partially_received':
      case 'received':
        return <Truck className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const filteredOrders = purchaseOrders.filter(po =>
    po.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">The requested branch could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Purchase Orders</h1>
            <p className="text-gray-600">Manage purchase orders for {branch.displayName}</p>
          </div>
          <Link href={`/${slug}/admin/purchase-orders/create`} className="btn-primary flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Create PO</span>
          </Link>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number or supplier..."
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
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="confirmed">Confirmed</option>
            <option value="sent">Sent</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No purchase orders found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Get started by creating your first purchase order'}
            </p>
            {!searchTerm && (
              <Link href={`/${slug}/admin/purchase-orders/create`} className="btn-primary">
                Create Purchase Order
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">PO Number</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Supplier</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Items</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Total</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Expected</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((po) => (
                    <tr key={po._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{po.orderNumber}</p>
                          <p className="text-xs text-gray-500">{formatDate(po.createdAt)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{po.supplierName}</p>
                          <p className="text-xs text-gray-500">{po.supplierEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {po.items?.length || 0} items
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {formatCurrency(po.total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                          {getStatusIcon(po.status)}
                          <span>{po.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/${slug}/admin/purchase-orders/${po._id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Details"
                          >
                            <FileText className="w-5 h-5" />
                          </Link>
                          {po.status === 'draft' && (
                            <>
                              <Link
                                href={`/${slug}/admin/purchase-orders/${po._id}/edit`}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <button
                                onClick={() => handleDelete(po._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {po.status === 'confirmed' && (
                            <button
                              onClick={() => handleStatusChange(po._id, 'sent')}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                              title="Mark as Sent"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          )}
                          {(po.status === 'sent' || po.status === 'partially_received') && (
                            <Link
                              href={`/${slug}/admin/purchase-orders/${po._id}/receive`}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                              title="Receive Items"
                            >
                              <Truck className="w-5 h-5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}