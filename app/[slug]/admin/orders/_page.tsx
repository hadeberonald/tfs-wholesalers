'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Eye, Package, Loader2, Hash, ArrowRightLeft, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import OrderHandlingLog from '@/components/admin/OrderHandlingLog';

interface Order {
  _id: string;
  orderNumber: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  items: any[];
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  status: string;
  paymentStatus: string;
  tillAccountNumber?: string | null;
  branchId?: string;
  assignedPickerId?: string;
  assignedPickerName?: string;
  createdAt: string;
}

interface Branch {
  _id: string;
  name?: string;
  displayName?: string;
  slug?: string;
}

interface Staff {
  _id: string;
  name: string;
  activeBranchId?: string;
  active?: boolean;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Branch reassign flow state
  const [reassignTarget, setReassignTarget] = useState('');
  const [confirmingReassign, setConfirmingReassign] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  // Picker reassign flow state
  const [pickers, setPickers] = useState<Staff[]>([]);
  const [pickerReassignTarget, setPickerReassignTarget] = useState('');
  const [confirmingPickerReassign, setConfirmingPickerReassign] = useState(false);
  const [reassigningPicker, setReassigningPicker] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchBranches();
  }, []);

  // Load pickers for the selected order's branch whenever the modal opens
  // on a (possibly different) order, and reset any in-progress picker
  // reassignment UI state so it doesn't leak between orders.
  useEffect(() => {
    setPickerReassignTarget('');
    setConfirmingPickerReassign(false);
    if (showModal && selectedOrder?.branchId) {
      fetchPickers(selectedOrder.branchId);
    } else {
      setPickers([]);
    }
  }, [showModal, selectedOrder?._id, selectedOrder?.branchId]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?all=true');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to load branches', error);
    }
  };

  const fetchPickers = async (branchId: string) => {
    try {
      // /api/admin/users doesn't take a branchId query param — for a
      // super-admin it returns pickers from every branch, so we filter to
      // this order's branch client-side. For a branch-scoped admin the API
      // has already narrowed it to their own branch, and this filter is a
      // no-op as long as that matches the order's branch.
      const res = await fetch('/api/admin/users?role=picker');
      if (res.ok) {
        const data = await res.json();
        const branchPickers = (data.users || []).filter(
          (u: Staff) => u.active !== false && String(u.activeBranchId) === String(branchId)
        );
        setPickers(branchPickers);
      }
    } catch (error) {
      console.error('Failed to load pickers', error);
    }
  };

  const branchLabel = (branchId?: string) => {
    if (!branchId) return '—';
    const b = branches.find(b => b._id === branchId);
    return b?.displayName || b?.name || branchId;
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const order = orders.find(o => o._id === orderId);
      if (!order) return;

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, status }),
      });

      if (res.ok) {
        toast.success('Order status updated');
        fetchOrders();
      } else {
        toast.error('Failed to update order');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  // ── Branch reassignment ────────────────────────────────────────────────
  const openReassign = (branchId: string) => {
    setReassignTarget(branchId);
    setConfirmingReassign(!!branchId && branchId !== selectedOrder?.branchId);
  };

  const confirmReassign = async () => {
    if (!selectedOrder || !reassignTarget) return;
    setReassigning(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder._id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: reassignTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Order moved to ${branchLabel(reassignTarget)}`);
        setSelectedOrder(prev => prev ? { ...prev, ...data.order, branchId: data.order.branchId } : prev);
        setConfirmingReassign(false);
        setReassignTarget('');
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to reassign order');
      }
    } catch (error) {
      toast.error('An error occurred while reassigning');
    } finally {
      setReassigning(false);
    }
  };

  // ── Picker reassignment ─────────────────────────────────────────────────
  const openPickerReassign = (pickerId: string) => {
    setPickerReassignTarget(pickerId);
    const currentPickerId = selectedOrder?.assignedPickerId || '';
    setConfirmingPickerReassign(pickerId !== currentPickerId);
  };

  const confirmPickerReassign = async () => {
    if (!selectedOrder) return;
    setReassigningPicker(true);
    try {
      const target = pickers.find(p => p._id === pickerReassignTarget);
      const res = await fetch(`/api/orders/${selectedOrder._id}/reassign-picker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickerId:   pickerReassignTarget || null,
          pickerName: target?.name ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(pickerReassignTarget ? `Order assigned to ${target?.name}` : 'Picker unassigned');
        setSelectedOrder(prev => prev ? { ...prev, ...data.order } : prev);
        setConfirmingPickerReassign(false);
        setPickerReassignTarget('');
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to reassign picker');
      }
    } catch (error) {
      toast.error('An error occurred while reassigning the picker');
    } finally {
      setReassigningPicker(false);
    }
  };

  const filteredOrders = orders
    .filter(order => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerInfo.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.tillAccountNumber ?? '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':    return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped':    return 'bg-purple-100 text-purple-800';
      case 'delivered':  return 'bg-green-100 text-green-800';
      case 'cancelled':  return 'bg-red-100 text-red-800';
      default:           return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':    return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed':  return 'bg-red-100 text-red-800';
      default:        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">Orders</h1>
          <p className="text-gray-600">{orders.length} total orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Orders', value: orders.length,                                         color: 'bg-blue-500'   },
            { label: 'Pending',      value: orders.filter(o => o.status === 'pending').length,     color: 'bg-yellow-500' },
            { label: 'Processing',   value: orders.filter(o => o.status === 'processing').length,  color: 'bg-purple-500' },
            { label: 'Delivered',    value: orders.filter(o => o.status === 'delivered').length,   color: 'bg-green-500'  },
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <Package className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-brand-black mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order number, customer, email, or till account…"
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                className="input-field pl-10"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Orders will appear here once customers place them'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Order</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Customer</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 hidden md:table-cell">Till Acc #</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Items</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Total</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Payment</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-brand-black">{order.orderNumber}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{order.customerInfo.name}</p>
                          <p className="text-sm text-gray-600">{order.customerInfo.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {order.tillAccountNumber ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg">
                            <Hash className="w-3 h-3 text-green-600 flex-shrink-0" />
                            <span className="font-mono text-xs font-semibold text-green-700">
                              {order.tillAccountNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {order.items.length} item{order.items.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-brand-black">R{order.total.toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-full border-0 ${getStatusColor(order.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setReassignTarget('');
                            setConfirmingReassign(false);
                            setShowModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="p-6 border-b sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-brand-black">Order Details</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Till Account Number — prominent banner when present */}
                {selectedOrder.tillAccountNumber && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Hash className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium">Till Account Number</p>
                      <p className="font-mono font-bold text-green-800 text-lg leading-tight">
                        {selectedOrder.tillAccountNumber}
                      </p>
                    </div>
                    <p className="text-xs text-green-600 ml-auto hidden sm:block">
                      Use this to ring up on the POS till
                    </p>
                  </div>
                )}

                {/* Order Info */}
                <div>
                  <h3 className="font-semibold text-brand-black mb-3">Order Information</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Order Number</p>
                      <p className="font-semibold">{selectedOrder.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Date</p>
                      <p className="font-semibold">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-600">Payment Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                        {selectedOrder.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Branch / Reassignment */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRightLeft className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-brand-black">Branch</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Currently at: <span className="font-semibold text-gray-900">{branchLabel(selectedOrder.branchId)}</span>
                  </p>

                  {['delivered', 'cancelled'].includes(selectedOrder.status) ? (
                    <p className="text-xs text-gray-400 italic">
                      This order is {selectedOrder.status} and can't be reassigned.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className="input-field text-sm max-w-xs"
                        value={reassignTarget}
                        onChange={(e) => openReassign(e.target.value)}
                      >
                        <option value="">Move to branch…</option>
                        {branches
                          .filter(b => b._id !== selectedOrder.branchId)
                          .map(b => (
                            <option key={b._id} value={b._id}>
                              {b.displayName || b.name}
                            </option>
                          ))}
                      </select>

                      {confirmingReassign && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={confirmReassign}
                            disabled={reassigning}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand-orange text-white disabled:opacity-50"
                          >
                            {reassigning ? 'Reassigning…' : `Confirm move to ${branchLabel(reassignTarget)}`}
                          </button>
                          <button
                            onClick={() => { setConfirmingReassign(false); setReassignTarget(''); }}
                            disabled={reassigning}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {['picking', 'packaging'].includes(selectedOrder.status) && (
                    <p className="text-xs text-amber-600 mt-2">
                      This order is mid-pick — reassigning will reset it to "Confirmed" and unassign the current picker so the new branch can start fresh.
                    </p>
                  )}
                </div>

                {/* Picker Reassignment */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCog className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-brand-black">Picker</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Currently assigned:{' '}
                    <span className="font-semibold text-gray-900">
                      {selectedOrder.assignedPickerName || 'Unassigned'}
                    </span>
                  </p>

                  {['delivered', 'cancelled'].includes(selectedOrder.status) ? (
                    <p className="text-xs text-gray-400 italic">
                      This order is {selectedOrder.status} and can't be reassigned.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className="input-field text-sm max-w-xs"
                        value={pickerReassignTarget}
                        onChange={(e) => openPickerReassign(e.target.value)}
                      >
                        <option value="">Unassign / no picker</option>
                        {pickers.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>

                      {confirmingPickerReassign && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={confirmPickerReassign}
                            disabled={reassigningPicker}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand-orange text-white disabled:opacity-50"
                          >
                            {reassigningPicker
                              ? 'Saving…'
                              : pickerReassignTarget
                                ? `Confirm assign to ${pickers.find(p => p._id === pickerReassignTarget)?.name ?? ''}`
                                : 'Confirm unassign'}
                          </button>
                          <button
                            onClick={() => { setConfirmingPickerReassign(false); setPickerReassignTarget(''); }}
                            disabled={reassigningPicker}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {pickers.length === 0 && (
                        <p className="text-xs text-gray-400 italic">
                          No pickers found for this branch.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="font-semibold text-brand-black mb-3">Customer Information</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Name:</strong> {selectedOrder.customerInfo.name}</p>
                    <p><strong>Email:</strong> {selectedOrder.customerInfo.email}</p>
                    <p><strong>Phone:</strong> {selectedOrder.customerInfo.phone}</p>
                    {selectedOrder.tillAccountNumber && (
                      <p>
                        <strong>Till Account #:</strong>{' '}
                        <span className="font-mono font-semibold text-green-700">
                          {selectedOrder.tillAccountNumber}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold text-brand-black mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.name}</p>
                          {item.variantName && (
                            <p className="text-xs text-gray-500">{item.variantName}</p>
                          )}
                          <p className="text-sm text-gray-600">Qty: {item.quantity} × R{item.price.toFixed(2)}</p>
                        </div>
                        <p className="font-semibold">R{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals breakdown */}
                <div className="border-t pt-4 space-y-2">
                  {selectedOrder.subtotal != null ? (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>R{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                  ) : null}

                  {(selectedOrder.deliveryFee ?? 0) > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Delivery Fee</span>
                      <span>R{(selectedOrder.deliveryFee ?? 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xl font-bold text-brand-black border-t pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-brand-orange">R{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Accountability Log */}
                <div className="border-t pt-2">
                  <OrderHandlingLog orderId={selectedOrder._id} />
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}