'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Search, Filter, Package, Truck, Check, Eye,
  CreditCard, AlertTriangle, Upload, Clock, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  customerId: string;
  customerBusinessName: string;
  items: Array<{
    productId: string;
    name: string;
    variantName?: string;
    quantity: number;
    totalUnits: number;
    totalPrice: number;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  paymentType: 'paystack' | 'credit' | 'pop';
  paymentMethod: string;
  deliveryAddress: any;
  deliveryNotes?: string;
  dueDate?: string;
  paidAt?: string;
  popUrl?: string;
  popStatus?: string;
  paystackReference?: string;
  createdAt: string;
}

type Tab = 'all' | 'pending_payment' | 'pop_review' | 'overdue' | 'credit';

const TABS: { key: Tab; label: string; color: string }[] = [
  { key: 'all',             label: 'All Orders',       color: 'gray'   },
  { key: 'pending_payment', label: 'Awaiting Payment', color: 'yellow' },
  { key: 'pop_review',      label: 'POP Review',       color: 'purple' },
  { key: 'overdue',         label: 'Overdue',          color: 'red'    },
  { key: 'credit',          label: 'Credit Accounts',  color: 'blue'   },
];

export default function AdminWholesaleOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [popRejectionReason, setPopRejectionReason] = useState('');
  const [runningOverdueCheck, setRunningOverdueCheck] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wholesale/orders?all=true');
      if (res.ok) { const data = await res.json(); setOrders(data.orders); }
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: status }),
      });
      if (res.ok) { toast.success('Order status updated'); fetchOrders(); setShowModal(false); }
      else toast.error('Failed to update status');
    } catch { toast.error('Failed to update status'); }
  };

  const handlePopAction = async (orderId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !popRejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popAction: action,
          popRejectionReason: action === 'reject' ? popRejectionReason : undefined,
        }),
      });
      if (res.ok) {
        toast.success(action === 'approve' ? 'POP approved — order confirmed' : 'POP rejected');
        fetchOrders();
        setShowModal(false);
        setPopRejectionReason('');
      } else toast.error('Failed to process POP');
    } catch { toast.error('Failed to process POP'); }
  };

  const markCreditPaid = async (orderId: string) => {
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid' }),
      });
      if (res.ok) { toast.success('Marked as paid'); fetchOrders(); setShowModal(false); }
      else toast.error('Failed to mark as paid');
    } catch { toast.error('Failed to mark as paid'); }
  };

  const runOverdueCheck = async () => {
    setRunningOverdueCheck(true);
    try {
      const res = await fetch('/api/wholesale/payments/check-overdue', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.overdueOrders} orders marked overdue, ${data.blocked} customers blocked`);
        fetchOrders();
      } else toast.error('Overdue check failed');
    } catch { toast.error('Overdue check failed'); }
    finally { setRunningOverdueCheck(false); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': case 'pending_payment': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'shipped': return 'bg-indigo-100 text-indigo-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'pending_pop_review': return 'bg-purple-100 text-purple-800';
      case 'pop_rejected': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentTypeIcon = (type: string) => {
    if (type === 'credit') return <CreditCard className="w-3 h-3" />;
    if (type === 'pop')    return <Upload className="w-3 h-3" />;
    return null;
  };

  // Tab-based filtering
  const tabFilteredOrders = orders.filter((o) => {
    if (activeTab === 'pending_payment') return o.paymentStatus === 'pending_payment';
    if (activeTab === 'pop_review')      return o.popStatus === 'pending_review';
    if (activeTab === 'overdue')         return o.paymentStatus === 'overdue';
    if (activeTab === 'credit')          return o.paymentType === 'credit';
    return true;
  });

  const filteredOrders = tabFilteredOrders.filter((o) => {
    const matchSearch =
      o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerBusinessName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingPaymentCount = orders.filter((o) => o.paymentStatus === 'pending_payment').length;
  const popReviewCount      = orders.filter((o) => o.popStatus === 'pending_review').length;
  const overdueCount        = orders.filter((o) => o.paymentStatus === 'overdue').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-1">Purchase Orders</h1>
            <p className="text-gray-600">Manage wholesale purchase orders and payments</p>
          </div>
          <button
            onClick={runOverdueCheck}
            disabled={runningOverdueCheck}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl hover:bg-red-100 text-sm font-medium disabled:opacity-50"
          >
            <Clock className="w-4 h-4" />
            {runningOverdueCheck ? 'Checking...' : 'Run Overdue Check'}
          </button>
        </div>

        {/* Alert banners */}
        {overdueCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-red-800 text-sm font-medium">
              {overdueCount} overdue order{overdueCount !== 1 ? 's' : ''} — affected customers are blocked from placing new orders.
            </p>
          </div>
        )}
        {popReviewCount > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Upload className="w-5 h-5 text-purple-600 shrink-0" />
            <p className="text-purple-800 text-sm font-medium">
              {popReviewCount} proof of payment{popReviewCount !== 1 ? 's' : ''} awaiting review.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const badge =
              tab.key === 'pending_payment' ? pendingPaymentCount :
              tab.key === 'pop_review'      ? popReviewCount :
              tab.key === 'overdue'         ? overdueCount : null;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-brand-orange text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-orange'
                }`}
              >
                {tab.label}
                {badge != null && badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.key ? 'bg-white/20' : 'bg-red-100 text-red-700'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-600 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-brand-black">{orders.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-6 shadow-sm border border-yellow-200">
            <p className="text-yellow-800 mb-1">Awaiting Payment</p>
            <p className="text-3xl font-bold text-yellow-900">{pendingPaymentCount}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 shadow-sm border border-purple-200">
            <p className="text-purple-800 mb-1">POP Review</p>
            <p className="text-3xl font-bold text-purple-900">{popReviewCount}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-6 shadow-sm border border-red-200">
            <p className="text-red-800 mb-1">Overdue</p>
            <p className="text-3xl font-bold text-red-900">{overdueCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No orders found</td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order._id}
                      className={`hover:bg-gray-50 ${order.paymentStatus === 'overdue' ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-6 py-4 font-semibold text-brand-black">{order.poNumber}</td>
                      <td className="px-6 py-4 font-medium text-brand-black">{order.customerBusinessName}</td>
                      <td className="px-6 py-4 font-semibold text-brand-black">R{order.total.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(order.paymentStatus)}`}>
                            {getPaymentTypeIcon(order.paymentType)}
                            {order.paymentStatus.replace(/_/g, ' ')}
                          </span>
                          {order.paymentType && (
                            <span className="text-xs text-gray-400 capitalize">{order.paymentType}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {order.dueDate
                          ? new Date(order.dueDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setSelectedOrder(order); setShowModal(true); }}
                          className="text-brand-orange hover:text-orange-600 font-medium text-sm inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-brand-black">{selectedOrder.poNumber}</h2>
                <p className="text-gray-600">{selectedOrder.customerBusinessName}</p>
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(selectedOrder.orderStatus)}`}>
                  {selectedOrder.orderStatus}
                </span>
                <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(selectedOrder.paymentStatus)}`}>
                  {selectedOrder.paymentStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Items */}
              <div>
                <h3 className="font-semibold text-brand-black mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-brand-black">
                          {item.name}{item.variantName ? ` - ${item.variantName}` : ''}
                        </p>
                        <p className="text-sm text-gray-600">
                          Qty: {item.quantity} = {item.totalUnits} units
                        </p>
                      </div>
                      <p className="font-semibold text-brand-orange">R{item.totalPrice.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">R{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (15%):</span>
                  <span className="font-semibold">R{selectedOrder.vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-brand-orange">R{selectedOrder.total.toFixed(2)}</span>
                </div>
                {selectedOrder.dueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Due Date:</span>
                    <span className={`font-semibold ${selectedOrder.paymentStatus === 'overdue' ? 'text-red-600' : 'text-gray-800'}`}>
                      {new Date(selectedOrder.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* POP Section */}
              {selectedOrder.popUrl && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5" /> Proof of Payment
                  </h3>
                  <a
                    href={selectedOrder.popUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium text-sm mb-4"
                  >
                    View POP Document →
                  </a>

                  {selectedOrder.popStatus === 'pending_review' && (
                    <div className="space-y-3">
                      <textarea
                        rows={2}
                        placeholder="Rejection reason (required if rejecting)..."
                        value={popRejectionReason}
                        onChange={(e) => setPopRejectionReason(e.target.value)}
                        className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handlePopAction(selectedOrder._id, 'approve')}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Approve POP
                        </button>
                        <button
                          onClick={() => handlePopAction(selectedOrder._id, 'reject')}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold text-sm"
                        >
                          Reject POP
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Credit manual mark paid */}
              {selectedOrder.paymentType === 'credit' &&
                ['pending', 'overdue'].includes(selectedOrder.paymentStatus) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Credit Account</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Mark this order as manually paid (e.g. bank transfer confirmed outside system).
                  </p>
                  <button
                    onClick={() => markCreditPaid(selectedOrder._id)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Mark as Paid
                  </button>
                </div>
              )}

              {/* Order status controls */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Update Order Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { label: 'Confirm',    status: 'confirmed',  enabled: ['pending', 'pending_payment'].includes(selectedOrder.orderStatus) },
                    { label: 'Processing', status: 'processing', enabled: selectedOrder.orderStatus === 'confirmed' },
                    { label: 'Shipped',    status: 'shipped',    enabled: selectedOrder.orderStatus === 'processing' },
                    { label: 'Delivered',  status: 'delivered',  enabled: selectedOrder.orderStatus === 'shipped' },
                    { label: 'Cancel',     status: 'cancelled',  enabled: !['delivered', 'cancelled'].includes(selectedOrder.orderStatus) },
                  ].map(({ label, status, enabled }) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(selectedOrder._id, status)}
                      disabled={!enabled}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
                        status === 'cancelled'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : status === 'delivered'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => { setShowModal(false); setPopRejectionReason(''); }}
                className="w-full py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}