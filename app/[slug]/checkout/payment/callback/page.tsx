'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function CheckoutPaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const reference = searchParams.get('reference');

    if (paymentStatus === 'success') {
      setStatus('success');
      setMessage('Payment successful! Your order has been confirmed.');
      
      // Redirect to order confirmation after 3 seconds
      setTimeout(() => {
        router.push(`/orders/${reference}`);
      }, 3000);
    } else {
      setStatus('failed');
      setMessage('Payment failed. Please try again or contact support.');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-brand-orange animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-gray-600">Please wait while we verify your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to your order details...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/checkout')}
              className="btn-primary w-full"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPaymentCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
        <Loader2 className="w-16 h-16 text-brand-orange animate-spin" />
      </div>
    }>
      <CheckoutPaymentCallbackContent />
    </Suspense>
  );
}