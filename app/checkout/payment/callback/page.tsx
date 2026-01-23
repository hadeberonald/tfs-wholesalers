'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCartStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    console.log('🔄 Payment callback page loaded');
    handleCallback();
  }, []);

  const handleCallback = async () => {
    // Get reference from URL
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    
    console.log('📍 Callback reference:', reference);
    
    if (!reference) {
      console.error('❌ No reference in callback');
      setStatus('failed');
      return;
    }

    try {
      console.log('🔍 Verifying payment...');
      
      // Verify payment
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      console.log('📡 Verify response status:', res.status);
      const data = await res.json();
      console.log('📊 Verify response data:', data);

      if (res.ok && data.verified) {
        console.log('✅ Payment verified!');
        console.log('🆔 Order ID:', data.orderId);
        
        setStatus('success');
        toast.success('Payment successful!');
        
        // Clear cart
        console.log('🧹 Clearing cart...');
        clearCart();
        
        // Redirect to success page
        const successUrl = `/checkout/success/${data.orderId}`;
        console.log('🎯 Redirecting to:', successUrl);
        
        setTimeout(() => {
          console.log('🚀 EXECUTING REDIRECT NOW');
          window.location.href = successUrl;
        }, 1000);
        
      } else {
        console.error('❌ Verification failed');
        setStatus('failed');
        toast.error('Payment verification failed');
      }
    } catch (error) {
      console.error('❌ Callback error:', error);
      setStatus('failed');
      toast.error('An error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
          {status === 'verifying' && (
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
              <p className="text-gray-600 mb-4">Redirecting to order confirmation...</p>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-black mb-2">Payment Failed</h2>
              <p className="text-gray-600 mb-6">There was an issue processing your payment.</p>
              <button
                onClick={() => router.push('/cart')}
                className="btn-primary"
              >
                Return to Cart
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}