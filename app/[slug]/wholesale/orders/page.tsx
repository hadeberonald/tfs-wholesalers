'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FileText, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  moq: number;
  moqUnit: string;
  unitsPerBox: number;
  quantity: number;
  totalUnits: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
}

interface WholesaleOrder {
  _id: string;
  poNumber: string;
  customerId: string;
  items: OrderItem[];
  deliveryAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  deliveryNotes?: string;
  deliveryFee: number;
  leadTimeDays: number;
  paymentMethod: 'account' | 'eft' | 'cash';
  customerNotes?: string;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

export default function WholesaleOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [user, setUser] = useState<any>(null);
  const [wholesaleCustomer, setWholesaleCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        
        // Fetch wholesale customer profile
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
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchOrders = async (customerId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/wholesale/orders?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      } else {
        toast.error('Failed to load orders');
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ready':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'dispatched':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Package className="w-4 h-4" />;
      case 'ready':
        return <Package className="w-4 h-4" />;
      case 'dispatched':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

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
            My Purchase Orders
          </h1>
          <p className="text-gray-600">
            {wholesaleCustomer?.businessName}
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-brand-black">{orders.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
            <p className="text-sm text-yellow-800 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">
              {orders.filter(o => o.status === 'pending').length}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-800 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-900">
              {orders.filter(o => ['confirmed', 'processing', 'ready', 'dispatched'].includes(o.status)).length}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
            <p className="text-sm text-green-800 mb-1">Delivered</p>
            <p className="text-2xl font-bold text-green-900">
              {orders.filter(o => o.status === 'delivered').length}
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
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="ready">Ready</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No orders found
            </h3>
            <p className="text-gray-500 mb-6">
              {statusFilter === 'all' 
                ? "You haven't placed any wholesale orders yet" 
                : `No ${statusFilter} orders found`}
            </p>
            <button
              onClick={() => router.push(`/${slug}/wholesale`)}
              className="btn-primary"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Order Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="bg-brand-orange bg-opacity-10 rounded-full p-3">
                        <FileText className="w-6 h-6 text-brand-orange" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-brand-black">
                          {order.poNumber}
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(order.createdAt).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand-orange">
                          R{(order.total || 0).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className={`px-3 py-2 rounded-lg border flex items-center space-x-2 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="font-semibold capitalize">{order.status}</span>
                      </div>

                      {expandedOrder === order._id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Quick Summary */}
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="capitalize">{order.paymentMethod} Payment</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Truck className="w-4 h-4" />
                      <span>{order.leadTimeDays} day lead time</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{order.deliveryAddress.city}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrder === order._id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Order Items */}
                      <div>
                        <h4 className="font-semibold text-brand-black mb-4 flex items-center space-x-2">
                          <Package className="w-5 h-5" />
                          <span>Order Items</span>
                        </h4>
                        <div className="space-y-3">
                          {order.items.map((item, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 flex items-center space-x-4">
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                />
                              )}
                              <div className="flex-1">
                                <p className="font-semibold text-brand-black">
                                  {item.name}
                                  {item.variantName && (
                                    <span className="text-gray-600 font-normal"> - {item.variantName}</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {item.quantity || 0} {item.moqUnit} × {item.unitsPerBox || 0} units
                                </p>
                                <p className="text-sm text-gray-600">
                                  R{(item.unitPrice || 0).toFixed(2)}/unit
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-brand-orange">
                                  R{(item.totalPrice || 0).toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {item.totalUnits || 0} units
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Price Breakdown */}
                        <div className="mt-4 bg-white rounded-lg p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">R{(order.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">VAT (15%):</span>
                            <span className="font-semibold">R{(order.vat || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Delivery:</span>
                            <span className="font-semibold">R{(order.deliveryFee || 0).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-200 pt-2 flex justify-between">
                            <span className="font-bold text-brand-black">Total:</span>
                            <span className="font-bold text-brand-orange text-lg">
                              R{(order.total || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery & Payment Info */}
                      <div>
                        <h4 className="font-semibold text-brand-black mb-4 flex items-center space-x-2">
                          <MapPin className="w-5 h-5" />
                          <span>Delivery Address</span>
                        </h4>
                        <div className="bg-white rounded-lg p-4 mb-6">
                          <p className="font-semibold text-brand-black mb-2">
                            {wholesaleCustomer?.businessName}
                          </p>
                          <p className="text-gray-600">{order.deliveryAddress.street}</p>
                          <p className="text-gray-600">
                            {order.deliveryAddress.city}, {order.deliveryAddress.province} {order.deliveryAddress.postalCode}
                          </p>
                          {order.deliveryNotes && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                <strong>Notes:</strong> {order.deliveryNotes}
                              </p>
                            </div>
                          )}
                        </div>

                        <h4 className="font-semibold text-brand-black mb-4 flex items-center space-x-2">
                          <DollarSign className="w-5 h-5" />
                          <span>Payment Information</span>
                        </h4>
                        <div className="bg-white rounded-lg p-4 mb-6">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Method:</span>
                            <span className="font-semibold capitalize">{order.paymentMethod}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Lead Time:</span>
                            <span className="font-semibold">{order.leadTimeDays} business days</span>
                          </div>
                          {order.customerNotes && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                <strong>Order Notes:</strong> {order.customerNotes}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Contact */}
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <p className="font-semibold text-blue-900 mb-2">Need help with this order?</p>
                          <div className="space-y-1 text-sm text-blue-800">
                            <p className="flex items-center space-x-2">
                              <Phone className="w-4 h-4" />
                              <span>{wholesaleCustomer?.phone}</span>
                            </p>
                            <p className="flex items-center space-x-2">
                              <Mail className="w-4 h-4" />
                              <span>{wholesaleCustomer?.email}</span>
                            </p>
                          </div>
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