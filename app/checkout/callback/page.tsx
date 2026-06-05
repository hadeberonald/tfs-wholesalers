//app/checkout/callback/page.tsx
'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function CheckoutCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'verifying' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const ref = searchParams.get('reference') || searchParams.get('trxref');
    const paystackStatus = searchParams.get('status');

    if (ref) setReference(ref);

    if (paystackStatus === 'cancelled' || paystackStatus === 'failed' || !ref) {
      setStatus('failed');
      setMessage('Payment was cancelled or did not complete. Please try again.');
      return;
    }

    verifyPayment(ref);
  }, [searchParams]);

  const verifyPayment = async (ref: string) => {
    setStatus('verifying');
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        setStatus('success');
        setMessage('Payment verified! Your order is confirmed and being prepared.');

        // Use branchSlug from verify response to redirect to the correct branch
        // success page. Fall back to a generic path if not available.
        setTimeout(() => {
          if (data.branchSlug && data.orderId) {
            router.push(`/${data.branchSlug}/checkout/success/${data.orderId}`);
          } else if (data.orderId) {
            router.push(`/checkout/success/${data.orderId}`);
          } else {
            router.push('/');
          }
        }, 3000);
      } else {
        console.error('[Callback] Verification failed:', data);
        setStatus('failed');
        setMessage(
          data.error ||
            'We could not verify your payment. If your card was charged, please contact support with your reference number.'
        );
      }
    } catch (err) {
      console.error('[Callback] Network error during verification:', err);
      setStatus('failed');
      setMessage(
        'A network error occurred while verifying your payment. Please contact support if you were charged.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {(status === 'loading' || status === 'verifying') && (
          <>
            <Loader2 className="w-16 h-16 text-brand-orange animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'loading' ? 'Processing Payment' : 'Verifying Payment'}
            </h2>
            <p className="text-gray-600">
              {status === 'loading'
                ? 'Please wait…'
                : 'Confirming your payment with Paystack. Please do not close this page.'}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to your order details…</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            {reference && (
              <p className="text-xs text-gray-400 mb-6 font-mono break-all">
                Reference: {reference}
              </p>
            )}
            <button
              onClick={() => router.back()}
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

export default function CheckoutCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
          <Loader2 className="w-16 h-16 text-brand-orange animate-spin" />
        </div>
      }
    >
      <CheckoutCallbackContent />
    </Suspense>
  );
}