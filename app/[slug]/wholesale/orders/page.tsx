'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText, Package, Clock, CheckCircle, XCircle, Truck,
  ChevronDown, ChevronUp, Calendar, DollarSign, MapPin,
  Upload, CreditCard, AlertCircle, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WholesaleOrder {
  _id: string;
  poNumber: string;
  items: any[];
  deliveryAddress: any;
  deliveryNotes?: string;
  deliveryFee: number;
  leadTimeDays: number;
  paymentType: 'paystack' | 'credit' | 'pop';
  customerNotes?: string;
  status: string;
  orderStatus: string;
  paymentStatus: string;
  popUrl?: string;
  popStatus?: string;
  dueDate?: string;
  paidAt?: string;
  subtotal: number;
  vat: number;
  vatAmount: number;
  total: number;
  createdAt: string;
}

export default function WholesaleOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [wholesaleCustomer, setWholesaleCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadingPop, setUploadingPop] = useState<string | null>(null); // orderId being uploaded
  const [initializingPaystack, setInitializingPaystack] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPopOrderId, setPendingPopOrderId] = useState<string | null>(null);

  useEffect(() => { fetchUser(); }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const customerRes = await fetch(`/api/wholesale/customers?userId=${data.user.id}`);
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          if (customerData.customers.length > 0) {
            const customer = customerData.customers[0];
            setWholesaleCustomer(customer);
            fetchOrders(customer._id);
          } else {
            toast.error('No wholesale account found');
            router.push(`/${slug}/wholesale`);
          }
        }
      } else {
        router.push(`/${slug}/wholesale/login?redirect=wholesale/orders`);
      }
    } catch { console.error('Failed to fetch user'); }
  };

  const fetchOrders = async (customerId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/wholesale/orders?customerId=${customerId}`);
      if (res.ok) { const data = await res.json(); setOrders(data.orders); }
      else toast.error('Failed to load orders');
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  const handlePayWithPaystack = async (order: WholesaleOrder) => {
    setInitializingPaystack(order._id);
    try {
      const res = await fetch('/api/wholesale/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order._id }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authorizationUrl;
      } else {
        toast.error('Failed to initialize payment');
      }
    } catch { toast.error('Failed to initialize payment'); }
    finally { setInitializingPaystack(null); }
  };

  const handlePopUpload = async (orderId: string, file: File) => {
    setUploadingPop(orderId);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });

      if (!uploadRes.ok) { toast.error('Failed to upload file'); return; }
      const uploadData = await uploadRes.json();

      // Submit POP URL to order
      const popRes = await fetch(`/api/wholesale/orders/${orderId}/pop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popUrl: uploadData.url }),
      });

      if (popRes.ok) {
        toast.success('Proof of payment submitted! Admin will review shortly.');
        fetchOrders(wholesaleCustomer._id);
      } else {
        toast.error('Failed to submit proof of payment');
      }
    } catch { toast.error('Failed to upload proof of payment'); }
    finally { setUploadingPop(null); setPendingPopOrderId(null); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': case 'pending_payment': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending_pop_review': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pop_rejected': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter((o) => o.orderStatus === statusFilter || o.paymentStatus === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      {/* Hidden file input for POP upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && pendingPopOrderId) handlePopUpload(pendingPopOrderId, file);
          e.target.value = '';
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-1">My Purchase Orders</h1>
          <p className="text-gray-600">{wholesaleCustomer?.businessName}</p>
        </div>

        {/* Outstanding balance warning */}
        {wholesaleCustomer?.blockedFromOrdering && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Account blocked — overdue balance</p>
                <p className="text-red-700 text-sm mt-0.5">
                  Outstanding: R{wholesaleCustomer.outstandingBalance?.toLocaleString()}.
                  Settle your overdue invoices to restore ordering.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-brand-black">{orders.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
            <p className="text-sm text-yellow-800 mb-1">Awaiting Payment</p>
            <p className="text-2xl font-bold text-yellow-900">
              {orders.filter((o) => o.paymentStatus === 'pending_payment').length}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-800 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-900">
              {orders.filter((o) =>
                ['confirmed', 'processing', 'shipped'].includes(o.orderStatus)
              ).length}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
            <p className="text-sm text-green-800 mb-1">Delivered</p>
            <p className="text-2xl font-bold text-green-900">
              {orders.filter((o) => o.orderStatus === 'delivered').length}
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="all">All Orders</option>
            <option value="pending_payment">Awaiting Payment</option>
            <option value="pending_pop_review">POP Under Review</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="delivered">Delivered</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No orders found</h3>
            <button onClick={() => router.push(`/${slug}/wholesale`)} className="btn-primary mt-4">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order._id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Order Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className="bg-brand-orange/10 rounded-full p-3">
                        <FileText className="w-6 h-6 text-brand-orange" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-brand-black">{order.poNumber}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('en-ZA', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold text-brand-orange">
                        R{(order.total ?? 0).toFixed(2)}
                      </p>

                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-lg border text-xs font-semibold capitalize ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                        <span className={`px-2 py-1 rounded-lg border text-xs font-medium ${getStatusColor(order.paymentStatus)}`}>
                          {order.paymentStatus?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {expandedOrder === order._id
                        ? <ChevronUp className="w-5 h-5 text-gray-400" />
                        : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Payment action prompts */}
                  {order.paymentStatus === 'pending_payment' && (
                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePayWithPaystack(order); }}
                        disabled={initializingPaystack === order._id}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        {initializingPaystack === order._id ? 'Redirecting...' : 'Pay via Paystack'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingPopOrderId(order._id);
                          fileInputRef.current?.click();
                        }}
                        disabled={uploadingPop === order._id}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        Upload POP
                      </button>
                    </div>
                  )}

                  {order.paymentStatus === 'pop_rejected' && (
                    <div className="mt-3">
                      <p className="text-sm text-orange-700 mb-2">
                        Your proof of payment was rejected. Please re-upload or pay via Paystack.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePayWithPaystack(order); }}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-orange-600"
                        >
                          <Zap className="w-4 h-4" /> Pay via Paystack
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingPopOrderId(order._id);
                            fileInputRef.current?.click();
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200"
                        >
                          <Upload className="w-4 h-4" /> Re-upload POP
                        </button>
                      </div>
                    </div>
                  )}

                  {order.paymentStatus === 'overdue' && (
                    <div className="mt-3 flex items-center gap-3 bg-red-50 rounded-lg p-3">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Payment Overdue</p>
                        <p className="text-xs text-red-600">
                          Due {new Date(order.dueDate!).toLocaleDateString()}. Please pay immediately.
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePayWithPaystack(order); }}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                      >
                        <Zap className="w-4 h-4" /> Pay Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded details */}
                {expandedOrder === order._id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Items */}
                      <div>
                        <h4 className="font-semibold text-brand-black mb-4">Order Items</h4>
                        <div className="space-y-3">
                          {order.items.map((item: any, index: number) => (
                            <div key={index} className="bg-white rounded-lg p-4 flex items-center gap-4">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                              )}
                              <div className="flex-1">
                                <p className="font-semibold text-brand-black">{item.name}</p>
                                <p className="text-sm text-gray-600">
                                  {item.quantity ?? 0} {item.moqUnit} × {item.unitsPerBox ?? 0} units
                                </p>
                              </div>
                              <p className="font-bold text-brand-orange">
                                R{(item.totalPrice ?? 0).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Totals */}
                        <div className="mt-4 bg-white rounded-lg p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">R{(order.subtotal ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">VAT (15%):</span>
                            <span className="font-semibold">R{(order.vatAmount ?? order.vat ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Delivery:</span>
                            <span className="font-semibold">R{(order.deliveryFee ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>Total:</span>
                            <span className="text-brand-orange text-lg">R{(order.total ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment & Delivery info */}
                      <div>
                        <h4 className="font-semibold text-brand-black mb-4">Payment Details</h4>
                        <div className="bg-white rounded-lg p-4 mb-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Method:</span>
                            <span className="font-semibold capitalize">{order.paymentType?.replace(/_/g, ' ')}</span>
                          </div>
                          {order.dueDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Due Date:</span>
                              <span className={`font-semibold ${order.paymentStatus === 'overdue' ? 'text-red-600' : ''}`}>
                                {new Date(order.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {order.paidAt && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Paid:</span>
                              <span className="font-semibold text-green-600">
                                {new Date(order.paidAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {order.popStatus && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">POP Status:</span>
                              <span className={`font-semibold capitalize ${
                                order.popStatus === 'approved' ? 'text-green-600' :
                                order.popStatus === 'rejected' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {order.popStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <h4 className="font-semibold text-brand-black mb-4">Delivery Address</h4>
                        <div className="bg-white rounded-lg p-4 text-sm">
                          <p className="font-semibold">{wholesaleCustomer?.businessName}</p>
                          <p className="text-gray-600">{order.deliveryAddress?.street}</p>
                          <p className="text-gray-600">
                            {order.deliveryAddress?.city}, {order.deliveryAddress?.province}{' '}
                            {order.deliveryAddress?.postalCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}