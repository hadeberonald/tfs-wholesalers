'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CreditCard, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Script from 'next/script';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, []);

  // Auto-trigger payment when order is loaded
  useEffect(() => {
    if (order && !processing && !error && paystackLoaded) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        if (order.paymentMethod === 'card') {
          handlePaystackPayment();
        } else if (order.paymentMethod === 'eft') {
          handleOzowPayment();
        }
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [order, paystackLoaded]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${params.orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      } else {
        setError('Order not found');
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handlePaystackPayment = async () => {
    setProcessing(true);
    setError('');

    try {
      // Initialize payment
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          email: order.customerInfo.email,
          amount: order.total,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Load Paystack inline
      if (typeof window !== 'undefined' && (window as any).PaystackPop) {
        const handler = (window as any).PaystackPop.setup({
          key: data.publicKey,
          email: order.customerInfo.email,
          amount: Math.round(order.total * 100), // Convert to kobo
          ref: data.reference,
          callback: async (response: any) => {
            // Payment successful
            await verifyPayment(response.reference);
          },
          onClose: () => {
            setProcessing(false);
            toast.error('Payment cancelled');
          },
        });

        handler.openIframe();
      } else {
        throw new Error('Paystack library not loaded');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment initialization failed');
      setProcessing(false);
      toast.error('Payment failed to start');
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        toast.success('Payment successful!');
        router.push(`/checkout/success/${order.id}`);
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('Payment verification failed');
      setProcessing(false);
      toast.error('Payment verification failed');
    }
  };

  const handleOzowPayment = async () => {
    setProcessing(true);
    setError('');

    try {
      const res = await fetch('/api/payment/ozow/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amount: order.total,
          customer: order.customerInfo.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Create form and submit to Ozow
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.paymentUrl;

      Object.keys(data.paymentRequest).forEach((key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data.paymentRequest[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment initialization failed');
      setProcessing(false);
      toast.error('Payment failed to start');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-brand-black mb-2">Order Not Found</h1>
            <p className="text-gray-600">The order you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Load Paystack Inline JS */}
      <Script 
        src="https://js.paystack.co/v1/inline.js"
        onLoad={() => setPaystackLoaded(true)}
      />

      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-brand-black mb-2">Complete Payment</h1>
            <p className="text-gray-600">Choose your payment method to complete your order</p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Payment Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-brand-black mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Order Number:</span>
                <span className="font-semibold text-brand-black">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>R{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee:</span>
                <span>R{order.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-brand-black border-t pt-3">
                <span>Total:</span>
                <span className="text-brand-orange">R{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {order.paymentMethod === 'card' && (
              <>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-900 text-center">
                    <strong>Payment popup opening...</strong> If it doesn't open automatically, click the button below.
                  </p>
                </div>
                <button
                  onClick={handlePaystackPayment}
                  disabled={processing}
                  className="w-full bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-brand-orange transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-brand-orange/10 rounded-full flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-brand-orange" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-brand-black mb-1">
                          Pay with Card (Paystack)
                        </h3>
                        <p className="text-sm text-gray-600">
                          Secure payment with credit or debit card
                        </p>
                      </div>
                    </div>
                    {processing ? (
                      <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
                    ) : (
                      <div className="text-brand-orange text-2xl font-bold">→</div>
                    )}
                  </div>
                </button>
              </>
            )}

            {order.paymentMethod === 'eft' && (
              <>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-900 text-center">
                    <strong>Redirecting to Ozow...</strong> If you're not redirected automatically, click the button below.
                  </p>
                </div>
                <button
                  onClick={handleOzowPayment}
                  disabled={processing}
                  className="w-full bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-brand-orange transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-brand-orange/10 rounded-full flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-brand-orange" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-brand-black mb-1">
                          Pay with EFT (Ozow)
                        </h3>
                        <p className="text-sm text-gray-600">
                          Instant EFT payment via Ozow
                        </p>
                      </div>
                    </div>
                    {processing ? (
                      <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
                    ) : (
                      <div className="text-brand-orange text-2xl font-bold">→</div>
                    )}
                  </div>
                </button>
              </>
            )}
          </div>

          <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong>Secure Payment:</strong> Your payment information is encrypted and secure. 
              We do not store your card details.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}