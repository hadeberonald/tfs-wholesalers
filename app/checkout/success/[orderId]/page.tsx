'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, Mail, Truck, Phone, MapPin, CreditCard, Loader2, User, LogIn, ShoppingBag, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCartStore } from '@/lib/store';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { clearCart } = useCartStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearCart();
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      console.log('🔍 Fetching order:', params.orderId);
      const res = await fetch(`/api/orders/${params.orderId}`);
      
      console.log('📡 Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch order: ${res.status}`);
      }

      const data = await res.json();
      console.log('📦 Order data received:', data);

      if (data.order) {
        setOrder(data.order);
      } else if (data) {
        // Handle case where order is directly in response
        setOrder(data);
      } else {
        throw new Error('No order data in response');
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch order:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-brand-black mb-4">Unable to Load Order</h1>
            <p className="text-gray-600 mb-2">We're having trouble loading your order details.</p>
            <p className="text-sm text-gray-500 mb-6">Error: {error || 'Order not found'}</p>
            <p className="text-sm text-gray-600 mb-6">
              Don't worry! Your payment was successful and we've received your order. 
              You should receive a confirmation email shortly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products" className="btn-primary">
                Continue Shopping
              </Link>
              {user && (
                <Link href="/account/orders" className="btn-secondary">
                  View My Orders
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const safeNumber = (value: any): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Success Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full mb-4 md:mb-6">
            <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-green-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-2 md:mb-4">
            Order Confirmed!
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-6 md:mb-8">
            Thank you for your purchase. Your order has been successfully placed.
          </p>

          {/* Order Reference */}
          <div className="bg-brand-orange/10 border-2 border-brand-orange rounded-xl p-4 md:p-6 mb-6">
            <p className="text-sm text-gray-600 mb-2">Order Reference Number</p>
            <p className="text-2xl md:text-3xl font-bold text-brand-orange tracking-wider font-mono">
              {order.orderNumber || order._id || params.orderId}
            </p>
            <p className="text-xs md:text-sm text-gray-600 mt-2">
              Keep this reference number for tracking your order
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Order Date</p>
              <p className="text-sm md:text-base font-semibold text-brand-black">
                {order.createdAt ? formatDate(order.createdAt) : formatDate(new Date().toISOString())}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-lg md:text-xl font-bold text-brand-orange">
                R{safeNumber(order.total).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 col-span-2 md:col-span-1">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Payment Status</p>
              <p className="text-sm md:text-base font-semibold text-green-600 capitalize">
                {order.paymentStatus || 'completed'}
              </p>
            </div>
          </div>
        </div>

        {/* What's Next Section */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-brand-black mb-6">What Happens Next?</h2>
          
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-black mb-1 text-base md:text-lg">Confirmation Email Sent</h3>
                <p className="text-sm md:text-base text-gray-600">
                  We've sent an order confirmation to <strong>{order.customerInfo?.email || order.email || 'your email'}</strong>. 
                  Check your inbox for order details and receipt.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-black mb-1 text-base md:text-lg">Order Processing</h3>
                <p className="text-sm md:text-base text-gray-600">
                  Our team is preparing your order for shipment. This usually takes 1-2 business days.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Truck className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-black mb-1 text-base md:text-lg">Shipping & Tracking</h3>
                <p className="text-sm md:text-base text-gray-600">
                  Once shipped, you'll receive a tracking number via email. 
                  Expected delivery: <strong>3-5 business days</strong>.
                </p>
              </div>
            </div>

            {order.shippingAddress && (
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-brand-black mb-1 text-base md:text-lg">Delivery Address</h3>
                  <p className="text-sm md:text-base text-gray-600">
                    {order.shippingAddress.address}, {order.shippingAddress.city}, 
                    {order.shippingAddress.province}, {order.shippingAddress.postalCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-brand-black mb-6">Order Summary</h2>
          
          {/* Items */}
          {order.items && order.items.length > 0 ? (
            <div className="space-y-4 mb-6">
              {order.items.map((item: any, index: number) => (
                <div key={index} className="flex items-center space-x-3 md:space-x-4 pb-4 border-b last:border-b-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item.image || '/placeholder.png'}
                      alt={item.name || 'Product'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm md:text-base text-brand-black line-clamp-2">{item.name || 'Product'}</p>
                    <p className="text-xs md:text-sm text-gray-600">
                      Quantity: {item.quantity || 0} × R{safeNumber(item.price).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-bold text-sm md:text-base text-brand-black flex-shrink-0">
                    R{(safeNumber(item.price) * (item.quantity || 0)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 mb-6">Loading order items...</p>
          )}

          {/* Price Breakdown */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between text-sm md:text-base text-gray-600">
              <span>Subtotal</span>
              <span>R{safeNumber(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm md:text-base text-gray-600">
              <span>Delivery Fee</span>
              <span>R{safeNumber(order.deliveryFee).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl md:text-2xl font-bold text-brand-black border-t pt-3">
              <span>Total Paid</span>
              <span className="text-brand-orange">R{safeNumber(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Customer Info & Payment */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-8">
          {/* Contact Information */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg md:text-xl font-bold text-brand-black mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm md:text-base font-semibold text-brand-black">{order.customerInfo?.name || order.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm md:text-base font-semibold text-brand-black break-all">{order.customerInfo?.email || order.email || 'N/A'}</p>
                </div>
              </div>
              {(order.customerInfo?.phone || order.phone) && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm md:text-base font-semibold text-brand-black">{order.customerInfo?.phone || order.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg md:text-xl font-bold text-brand-black mb-4">Payment Information</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-sm md:text-base font-semibold text-brand-black capitalize">
                    {order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod || 'Card'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <p className="text-sm md:text-base font-semibold text-green-600 capitalize">{order.paymentStatus || 'completed'}</p>
                </div>
              </div>
              {order.paymentDetails?.reference && (
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <span className="text-xs text-gray-400">#</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment Reference</p>
                    <p className="text-xs font-mono text-brand-black break-all">{order.paymentDetails.reference}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Section */}
        {!user ? (
          <div className="bg-gradient-to-r from-brand-orange to-orange-600 rounded-2xl p-6 md:p-8 shadow-lg mb-8 text-white">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-bold mb-2">Track Your Order Anytime</h3>
                <p className="text-white/90 mb-4 text-sm md:text-base">
                  Create an account to easily track your order status, view order history, and enjoy faster checkout next time!
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link 
                    href="/register?redirect=/account/orders"
                    className="bg-white text-brand-orange px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-center"
                  >
                    Create Account
                  </Link>
                  <Link 
                    href="/login?redirect=/account/orders"
                    className="bg-white/10 backdrop-blur text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors text-center"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 md:p-8 shadow-lg mb-8 text-white">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-bold mb-2">Monitor Your Order</h3>
                <p className="text-white/90 mb-4 text-sm md:text-base">
                  View detailed order status, track shipments, and access your complete order history.
                </p>
                <Link 
                  href="/account/orders"
                  className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors inline-block"
                >
                  View My Orders
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/products" className="btn-primary flex-1 text-center py-4 flex items-center justify-center space-x-2">
            <ShoppingBag className="w-5 h-5" />
            <span>Continue Shopping</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="btn-secondary flex-1 py-4"
          >
            Print Order Details
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-gray-100 rounded-xl p-6 text-center">
          <p className="text-sm md:text-base text-gray-600 mb-2">
            Need help with your order?
          </p>
          <Link href="/contact" className="text-brand-orange font-semibold hover:underline text-sm md:text-base">
            Contact our support team
          </Link>
        </div>
      </div>
    </div>
  );
}