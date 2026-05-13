'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Package, Truck, Check, X, Eye } from 'lucide-react';
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
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'overdue';
  paymentMethod: string;
  deliveryAddress: any;
  deliveryNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminWholesaleOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wholesale/orders?all=true');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: status }),
      });

      if (res.ok) {
        toast.success('Order status updated');
        fetchOrders();
        setShowModal(false);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerBusinessName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.orderStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'shipped': return 'bg-indigo-100 text-indigo-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingCount = orders.filter(o => o.orderStatus === 'pending').length;
  const processingCount = orders.filter(o => 
    ['confirmed', 'processing', 'shipped'].includes(o.orderStatus)
  ).length;
  const completedCount = orders.filter(o => o.orderStatus === 'delivered').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">
            Purchase Orders
          </h1>
          <p className="text-gray-600">
            Manage wholesale purchase orders
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total Orders</p>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-brand-black">{orders.length}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-6 shadow-sm border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-yellow-800">Pending</p>
              <FileText className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 shadow-sm border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-800">Processing</p>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{processingCount}</p>
          </div>

          <div className="bg-green-50 rounded-xl p-6 shadow-sm border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-800">Completed</p>
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{completedCount}</p>
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

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    PO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-brand-black">
                          {order.poNumber}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-brand-black">
                          {order.customerBusinessName}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {order.items.length} items
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items.reduce((sum, item) => sum + item.totalUnits, 0)} units
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-brand-black">
                          R{order.total.toFixed(2)}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowModal(true);
                          }}
                          className="text-brand-orange hover:text-orange-600 font-medium text-sm inline-flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-brand-black">
                    {selectedOrder.poNumber}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {selectedOrder.customerBusinessName}
                  </p>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(selectedOrder.orderStatus)}`}>
                  {selectedOrder.orderStatus}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-brand-black mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-brand-black">
                          {item.name}
                          {item.variantName && ` - ${item.variantName}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity} = {item.totalUnits} units
                        </p>
                      </div>
                      <p className="font-semibold text-brand-orange">
                        R{item.totalPrice.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Address */}
              {selectedOrder.deliveryAddress && (
                <div>
                  <h3 className="font-semibold text-brand-black mb-3 flex items-center space-x-2">
                    <Truck className="w-5 h-5" />
                    <span>Delivery Address</span>
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p>{selectedOrder.deliveryAddress.street}</p>
                    <p>
                      {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.province} {selectedOrder.deliveryAddress.postalCode}
                    </p>
                  </div>
                  {selectedOrder.deliveryNotes && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p className="font-medium">Delivery Notes:</p>
                      <p>{selectedOrder.deliveryNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold">R{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (15%):</span>
                    <span className="font-semibold">R{selectedOrder.vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-brand-black border-t border-gray-200 pt-2">
                    <span>Total:</span>
                    <span className="text-brand-orange">R{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Update Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => updateOrderStatus(selectedOrder._id, 'confirmed')}
                    disabled={selectedOrder.orderStatus !== 'pending'}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder._id, 'processing')}
                    disabled={!['confirmed'].includes(selectedOrder.orderStatus)}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Processing
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder._id, 'shipped')}
                    disabled={!['processing'].includes(selectedOrder.orderStatus)}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Shipped
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder._id, 'delivered')}
                    disabled={!['shipped'].includes(selectedOrder.orderStatus)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Delivered
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder._id, 'cancelled')}
                    disabled={['delivered', 'cancelled'].includes(selectedOrder.orderStatus)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
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