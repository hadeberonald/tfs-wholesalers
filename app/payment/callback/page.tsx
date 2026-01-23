'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'cancelled'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const paymentRef = reference || trxref;

    if (!paymentRef) {
      setStatus('error');
      return;
    }

    try {
      // Verify the payment
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: paymentRef }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        setStatus('success');
        setOrderId(data.orderId);
        
        // Redirect to success page after 2 seconds
        setTimeout(() => {
          if (data.orderId) {
            router.push(`/checkout/success/${data.orderId}`);
          }
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Callback error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-brand-orange animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-brand-black mb-2">Verifying Payment</h2>
              <p className="text-gray-600">Please wait while we confirm your payment...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-black mb-2">Payment Successful!</h2>
              <p className="text-gray-600 mb-4">Your payment has been confirmed. Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-black mb-2">Payment Failed</h2>
              <p className="text-gray-600 mb-6">There was an issue processing your payment.</p>
              <Link href="/cart" className="btn-primary inline-block">
                Return to Cart
              </Link>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-black mb-2">Payment Cancelled</h2>
              <p className="text-gray-600 mb-6">Your payment was cancelled.</p>
              <Link href="/cart" className="btn-primary inline-block">
                Return to Cart
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}