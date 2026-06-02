'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShoppingCart, Trash2, Package, FileText, Truck, CreditCard,
  Upload, AlertCircle, Zap, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
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

type PaymentType = 'paystack' | 'credit' | 'pop';

export default function WholesaleCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [user, setUser] = useState<any>(null);
  const [wholesaleCustomer, setWholesaleCustomer] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirectingPaystack, setRedirectingPaystack] = useState(false);

  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee] = useState(200);
  const [leadTimeDays] = useState(3);
  const [paymentType, setPaymentType] = useState<PaymentType>('paystack');
  const [customerNotes, setCustomerNotes] = useState('');

  useEffect(() => {
    fetchUser();
    loadCart();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);

        const customerRes = await fetch(`/api/wholesale/customers?userId=${data.user.id}`);
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          if (customerData.customers.length > 0) {
            setWholesaleCustomer(customerData.customers[0]);
          }
        }
      } else {
        router.push(`/${slug}/wholesale/login?redirect=wholesale/checkout`);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const stored = localStorage.getItem('wholesale-cart');
    if (stored) setCart(JSON.parse(stored));
  };

  const removeFromCart = (id: string, variantId?: string) => {
    const newCart = cart.filter(
      (item) => !(item.id === id && item.variantId === variantId)
    );
    setCart(newCart);
    localStorage.setItem('wholesale-cart', JSON.stringify(newCart));
    toast.success('Removed from cart');
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat + deliveryFee;
  const totalUnits = cart.reduce((sum, item) => sum + item.totalUnits, 0);

  const creditApproved = wholesaleCustomer?.creditApproved === true;
  const blockedFromOrdering = wholesaleCustomer?.blockedFromOrdering === true;
  const outstandingBalance = wholesaleCustomer?.outstandingBalance ?? 0;

  const handleSubmitOrder = async () => {
    if (!wholesaleCustomer) { toast.error('Wholesale account not found'); return; }
    if (wholesaleCustomer.verificationStatus !== 'approved') {
      toast.error('Your wholesale account is pending approval');
      router.push(`/${slug}/wholesale/pending`);
      return;
    }
    if (blockedFromOrdering) {
      toast.error('Your account is blocked due to an overdue balance. Please settle your account first.');
      return;
    }
    if (cart.length === 0) { toast.error('Your cart is empty'); return; }

    setSubmitting(true);

    try {
      const orderData = {
        customerId: wholesaleCustomer._id,
        paymentType,
        items: cart.map((item) => ({
          productId: item.id,
          variantId: item.variantId,
          name: item.name,
          variantName: item.variantName,
          sku: item.sku,
          moq: item.moq,
          moqUnit: item.moqUnit,
          unitsPerBox: item.unitsPerBox,
          quantity: item.quantity,
          totalUnits: item.totalUnits,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          image: item.image,
        })),
        deliveryAddress: wholesaleCustomer.businessAddress,
        deliveryNotes,
        deliveryFee,
        leadTimeDays,
        customerNotes,
      };

      const res = await fetch('/api/wholesale/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to create order');
        return;
      }

      const data = await res.json();
      localStorage.removeItem('wholesale-cart');
      setCart([]);

      // Route based on payment type
      if (paymentType === 'paystack') {
        // Initialize Paystack payment
        setRedirectingPaystack(true);
        const payRes = await fetch('/api/wholesale/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();
          window.location.href = payData.authorizationUrl;
        } else {
          toast.error('Failed to initialize payment. Order saved — you can pay from your orders page.');
          router.push(`/${slug}/wholesale/orders`);
        }
      } else {
        toast.success(`Purchase Order ${data.poNumber} created!`);
        router.push(`/${slug}/wholesale/orders`);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error('Failed to submit order');
    } finally {
      setSubmitting(false);
      setRedirectingPaystack(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-brand-black mb-8">Wholesale Checkout</h1>

        {/* Blocked account warning */}
        {blockedFromOrdering && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-1">Account Blocked</h3>
                <p className="text-red-700 text-sm">
                  Your account has been blocked due to an overdue balance of{' '}
                  <strong>R{outstandingBalance.toLocaleString()}</strong>. Please settle your
                  outstanding invoices before placing new orders.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Outstanding balance notice */}
        {!blockedFromOrdering && outstandingBalance > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="text-yellow-800 text-sm">
              You have an outstanding balance of <strong>R{outstandingBalance.toLocaleString()}</strong>.
              Please settle it on time to avoid account suspension.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cart Items */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Order Items ({cart.length})
              </h2>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-brand-black">
                          {item.name}
                          {item.variantName && (
                            <span className="text-gray-500 font-normal"> - {item.variantName}</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {item.quantity} {item.moqUnit} = {item.totalUnits} units
                        </p>
                        <p className="text-sm text-gray-500">R{item.unitPrice.toFixed(2)}/unit</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-orange">R{item.totalPrice.toFixed(2)}</p>
                        <button
                          onClick={() => removeFromCart(item.id, item.variantId)}
                          className="text-red-500 hover:text-red-600 text-sm mt-1 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                <Truck className="w-6 h-6" /> Delivery Address
              </h2>
              {wholesaleCustomer?.businessAddress && (
                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                  <p className="font-semibold text-brand-black mb-1">{wholesaleCustomer.businessName}</p>
                  <p className="text-gray-600">{wholesaleCustomer.businessAddress.street}</p>
                  <p className="text-gray-600">
                    {wholesaleCustomer.businessAddress.city}, {wholesaleCustomer.businessAddress.province}{' '}
                    {wholesaleCustomer.businessAddress.postalCode}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Special delivery instructions..."
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                <CreditCard className="w-6 h-6" /> Payment Method
              </h2>

              <div className="space-y-3">
                {/* Paystack — always available */}
                <label
                  className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    paymentType === 'paystack'
                      ? 'border-brand-orange bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value="paystack"
                    checked={paymentType === 'paystack'}
                    onChange={() => setPaymentType('paystack')}
                    className="mt-1 accent-brand-orange"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-orange" />
                      <p className="font-semibold text-brand-black">Pay via Paystack</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Card, EFT, or instant payment. Order confirmed immediately.
                    </p>
                  </div>
                </label>

                {/* EFT / Proof of Payment — always available */}
                <label
                  className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    paymentType === 'pop'
                      ? 'border-brand-orange bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value="pop"
                    checked={paymentType === 'pop'}
                    onChange={() => setPaymentType('pop')}
                    className="mt-1 accent-brand-orange"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <p className="font-semibold text-brand-black">EFT / Direct Deposit</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Submit order then upload proof of payment. Confirmed after admin review.
                    </p>
                  </div>
                </label>

                {/* Credit account — only shown if creditApproved */}
                {creditApproved && (
                  <label
                    className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                      paymentType === 'credit'
                        ? 'border-brand-orange bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentType"
                      value="credit"
                      checked={paymentType === 'credit'}
                      onChange={() => setPaymentType('credit')}
                      className="mt-1 accent-brand-orange"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <p className="font-semibold text-brand-black">Credit Account</p>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          Net {wholesaleCustomer.netTerms}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Order on account. Payment due in {wholesaleCustomer.netTerms} days.
                        Credit limit: R{wholesaleCustomer.creditLimit?.toLocaleString()}.
                      </p>
                    </div>
                  </label>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Any special requests or notes..."
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-32">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6" /> Order Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Total Units:</span>
                  <span className="font-semibold">{totalUnits}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">R{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (15%):</span>
                  <span className="font-semibold">R{vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery:</span>
                  <span className="font-semibold">R{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="text-brand-orange">R{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment type summary */}
              <div className="bg-gray-50 rounded-xl p-3 mb-6 text-sm">
                {paymentType === 'paystack' && (
                  <p className="text-gray-700">
                    You will be redirected to Paystack to complete payment after placing the order.
                  </p>
                )}
                {paymentType === 'pop' && (
                  <p className="text-gray-700">
                    After placing the order, upload your proof of payment from the orders page. Order will be confirmed after admin review.
                  </p>
                )}
                {paymentType === 'credit' && (
                  <p className="text-gray-700">
                    Order placed on account. Payment due in{' '}
                    <strong>{wholesaleCustomer?.netTerms} days</strong>.
                  </p>
                )}
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submitting || redirectingPaystack || cart.length === 0 || blockedFromOrdering}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redirectingPaystack
                  ? 'Redirecting to Paystack...'
                  : submitting
                  ? 'Submitting...'
                  : paymentType === 'paystack'
                  ? 'Place Order & Pay Now'
                  : 'Submit Purchase Order'}
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                By submitting, you agree to our wholesale terms and conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}