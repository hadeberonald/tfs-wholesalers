'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCartStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import {
  ShoppingBag, User, MapPin, CreditCard, Loader2, Plus, FileText,
  AlertCircle, Tag, X, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Dynamically import map component
const AddressMapPicker = dynamic(() => import('@/components/AddressMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-80 bg-gray-100 rounded-xl flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  ),
});

interface SavedCard {
  id: string;
  authorizationCode?: string;
  cardNumber: string;
  cardHolder?: string;
  expiryDate: string;
  cardType: string;
  isDefault: boolean;
}

interface AppliedPromo {
  id: string;
  code: string;
  type: 'free_delivery' | 'percentage' | 'fixed_amount';
  value: number;
  description: string | null;
  discountAppliesTo: 'delivery' | 'subtotal';
  discountAmount: number; // 0 for free_delivery — the real delivery fee is zeroed client-side
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { branch, loading: branchLoading } = useBranch();
  const { items, getTotal, clearCart } = useCartStore();
  const total = getTotal();
  const [checkoutAs, setCheckoutAs] = useState<'guest' | 'user' | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<any>(null);
  const [storeLocation, setStoreLocation] = useState({ lat: -27.763912, lng: 30.798969 });
  const deliveryFee = 35;
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [locationValid, setLocationValid] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const maxDeliveryRadius = 15;

  // ── Promo code state ──────────────────────────────────────────────────────
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    lat: 0,
    lng: 0,
    city: '',
    province: 'KwaZulu-Natal',
    postalCode: '',
    deliveryNotes: '',
    paymentMethod: 'card',
  });

  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, [items, router]);

  useEffect(() => {
    if (branch && !branchLoading) {
      fetchSettings();
    }
  }, [branch, branchLoading]);

  useEffect(() => {
    if (user) {
      setCheckoutAs('user');
      setFormData(prev => ({
        ...prev,
        name: user.name,
        email: user.email,
      }));
      fetchSavedCards();
    }
  }, [user]);

  const fetchSavedCards = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/payment-methods?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSavedCards(data.paymentMethods || []);
        const defaultCard = data.paymentMethods?.find((c: SavedCard) => c.isDefault);
        if (defaultCard) setSelectedCard(defaultCard.id);
      }
    } catch (error) {
      console.error('Failed to fetch saved cards:', error);
    }
  };

  const fetchSettings = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/settings?branchId=${branch.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setDeliverySettings(data.settings);
        }
        if (data.location) setStoreLocation(data.location);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setDeliverySettings({
        local: 35, localRadius: 15,
        medium: 35, mediumRadius: 40,
        far: 35, farRadius: 60,
      });
    }
  };

  const handleLocationSelect = (locationData: {
    lat: number; lng: number; address: string;
    distance: number; deliveryFee: number;
  }) => {
    setLocationTouched(true);
    setSelectedDistance(locationData.distance);
    setFormData({ ...formData, address: locationData.address, lat: locationData.lat, lng: locationData.lng });
    setLocationValid(locationData.distance <= maxDeliveryRadius);
  };

  // ── Promo code handlers ───────────────────────────────────────────────────
  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      setPromoError('Please enter a promo code');
      return;
    }
    if (!branch) {
      setPromoError('Branch not loaded yet — please try again in a moment');
      return;
    }

    setApplyingPromo(true);
    setPromoError('');

    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branch.id,
          code,
          subtotal: total,
          email: formData.email || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promo code');
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        id: data.promoCode.id,
        code: data.promoCode.code,
        type: data.promoCode.type,
        value: data.promoCode.value,
        description: data.promoCode.description,
        discountAppliesTo: data.discountAppliesTo,
        discountAmount: data.discountAmount,
      });
      setPromoInput('');
      toast.success(
        data.discountAppliesTo === 'delivery'
          ? 'Free delivery applied!'
          : `Promo applied — R${data.discountAmount.toFixed(2)} off`
      );
    } catch (error) {
      console.error('Promo validation error:', error);
      setPromoError('Failed to validate promo code. Please try again.');
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
    toast('Promo code removed');
  };

  // ── Totals (accounting for the applied promo) ─────────────────────────────
  const effectiveDeliveryFee = appliedPromo?.type === 'free_delivery' ? 0 : deliveryFee;
  const subtotalDiscount = appliedPromo && appliedPromo.type !== 'free_delivery' ? appliedPromo.discountAmount : 0;
  const finalTotal = Math.max(0, total - subtotalDiscount + effectiveDeliveryFee);

  const handlePaystackPayment = async (orderId: string, orderData: any) => {
    console.log('💳 Initializing Paystack payment…');
    try {
      const savedCardData = selectedCard && !useNewCard
        ? savedCards.find(c => c.id === selectedCard)
        : null;

      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          email: orderData.customerInfo.email,
          amount: orderData.total,
          authorizationCode: savedCardData?.authorizationCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');

      console.log('✅ Payment initialized:', data.reference);

      if (savedCardData?.authorizationCode && data.charged) {
        console.log('✅ Charged with saved card');
        await verifyAndRedirect(data.reference, orderId);
        return;
      }

      if (!(window as any).PaystackPop) throw new Error('Paystack not loaded');

      const handler = (window as any).PaystackPop.setup({
        key: data.publicKey,
        email: orderData.customerInfo.email,
        amount: Math.round(orderData.total * 100),
        currency: 'ZAR',
        ref: data.reference,
        callback: function (response: any) {
          console.log('✅ Paystack callback received:', response.reference);
          if (user && useNewCard && response.authorization) {
            savePaymentMethod(response.authorization);
          }
          verifyAndRedirect(response.reference, orderId);
        },
        onClose: function () {
          setLoading(false);
          toast.error('Payment cancelled');
          console.log('❌ Payment popup closed');
        },
      });

      handler.openIframe();
      console.log('🎯 Paystack popup opened');
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setLoading(false);
      toast.error(error.message || 'Payment failed to start');
    }
  };

  const verifyAndRedirect = async (reference: string, orderId: string) => {
    console.log('🔍 Verifying payment:', reference);
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        console.log('✅ Payment verified — order confirmed');
        clearCart();
        toast.success('Payment successful!');
        router.push(`/${branch?.slug}/checkout/success/${orderId}`);
      } else {
        console.error('❌ Verification failed:', data);
        throw new Error(data.error || 'Payment verification failed');
      }
    } catch (error: any) {
      console.error('❌ Verification error:', error);
      setLoading(false);
      toast.error(error.message || 'Payment verification failed. Please contact support.');
    }
  };

  const savePaymentMethod = async (authorization: any) => {
    try {
      await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          authorizationCode: authorization.authorization_code,
          cardNumber: authorization.last4,
          cardType: authorization.card_type,
          expiryMonth: authorization.exp_month,
          expiryYear: authorization.exp_year,
          bin: authorization.bin,
          last4: authorization.last4,
          bank: authorization.bank,
        }),
      });
      console.log('💾 Payment method saved');
      toast.success('Card saved for future use!');
    } catch (error) {
      console.error('Failed to save payment method:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branch) { toast.error('Branch information not loaded'); return; }
    if (!locationValid) { toast.error('Please select a delivery location within our service area'); return; }
    if (formData.paymentMethod === 'card' && user && savedCards.length > 0 && !selectedCard && !useNewCard) {
      toast.error('Please select a payment method'); return;
    }

    setLoading(true);
    console.log('📦 Creating order for branch:', branch.displayName);

    try {
      const orderData = {
        branchId: branch.id,
        userId: user?.id || null,
        customerInfo: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
        shippingAddress: {
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
        },
        items: items.map(item => ({
          productId: item.id,
          variantId: item.variantId,
          name: item.name,
          variantName: item.variantName,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          sku: item.sku,
          appliedSpecialId: item.appliedSpecialId,
        })),
        subtotal: total,
        deliveryFee: effectiveDeliveryFee,
        // Promo details — the orders API uses this to increment usedCount and
        // log a promoCodeUsages record. Omit entirely if nothing was applied.
        promoCode: appliedPromo ? {
          id: appliedPromo.id,
          code: appliedPromo.code,
          type: appliedPromo.type,
          discountAppliesTo: appliedPromo.discountAppliesTo,
          discountAmount: appliedPromo.discountAppliesTo === 'delivery'
            ? (deliveryFee - effectiveDeliveryFee)
            : subtotalDiscount,
        } : null,
        total: finalTotal,
        deliveryNotes: formData.deliveryNotes,
        paymentMethod: formData.paymentMethod,
        paymentStatus: 'pending',
        status: 'payment_pending',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('✅ Order created (payment_pending):', data.orderId);

        if (formData.paymentMethod === 'card') {
          setTimeout(() => handlePaystackPayment(data.orderId, orderData), 500);
        } else if (formData.paymentMethod === 'eft') {
          setLoading(false);
          toast.error('EFT payment coming soon');
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to create order');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Checkout error:', error);
      toast.error('An error occurred during checkout');
      setLoading(false);
    }
  };

  if (branchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">Please select a branch to continue</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  if (!checkoutAs) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <ShoppingBag className="w-16 h-16 text-brand-orange mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-brand-black mb-2">Checkout</h1>
            <p className="text-gray-600">Shopping at {branch.displayName}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setCheckoutAs('guest')}
              className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-brand-orange transition-colors text-left group"
            >
              <User className="w-12 h-12 text-gray-400 group-hover:text-brand-orange mb-4" />
              <h3 className="text-xl font-semibold text-brand-black mb-2">Checkout as Guest</h3>
              <p className="text-gray-600">Complete your purchase without creating an account</p>
            </button>

            {!user ? (
              <Link
                href={`/${branch.slug}/login?redirect=checkout`}
                className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-brand-orange transition-colors text-left group"
              >
                <User className="w-12 h-12 text-gray-400 group-hover:text-brand-orange mb-4" />
                <h3 className="text-xl font-semibold text-brand-black mb-2">Sign In</h3>
                <p className="text-gray-600">Track your orders and save your information</p>
              </Link>
            ) : (
              <button
                onClick={() => setCheckoutAs('user')}
                className="bg-white rounded-2xl p-8 border-2 border-brand-orange transition-colors text-left"
              >
                <User className="w-12 h-12 text-brand-orange mb-4" />
                <h3 className="text-xl font-semibold text-brand-black mb-2">Continue as {user.name}</h3>
                <p className="text-gray-600 text-sm">{user.email}</p>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const addressOutOfRange = locationTouched && selectedDistance !== null && selectedDistance > maxDeliveryRadius;
  const canSubmit = locationValid && !loading;

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">Checkout</h1>
          <p className="text-gray-600">Shopping at {branch.displayName}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <User className="w-6 h-6 text-brand-orange" />
                  <h2 className="text-xl font-semibold text-brand-black">Customer Information</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" required className="input-field" value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" required className="input-field" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Your order confirmation will be sent here. Please check your spam or junk folder if you don&apos;t see it.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <input type="tel" required className="input-field" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g., 082 123 4567" />
                  </div>
                </div>
              </div>

              {/* Delivery Location */}
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <MapPin className="w-6 h-6 text-brand-orange" />
                  <h2 className="text-xl font-semibold text-brand-black">Delivery Location</h2>
                </div>
                {deliverySettings && (
                  <AddressMapPicker
                    onLocationSelect={handleLocationSelect}
                    storeLocation={storeLocation}
                    deliverySettings={deliverySettings}
                  />
                )}

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City (Optional)</label>
                    <input type="text" className="input-field" value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Durban" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code (Optional)</label>
                    <input type="text" className="input-field" value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder="4001" />
                  </div>
                </div>
              </div>

              {/* Delivery Notes */}
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <FileText className="w-6 h-6 text-brand-orange" />
                  <h2 className="text-xl font-semibold text-brand-black">Delivery Instructions</h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes (Optional)</label>
                  <textarea rows={4} className="input-field" value={formData.deliveryNotes}
                    onChange={(e) => setFormData({ ...formData, deliveryNotes: e.target.value })}
                    placeholder="Please give us any delivery instructions or specific directions to find you easily…" />
                  <p className="text-xs text-gray-500 mt-2">
                    Example: &quot;Ring the intercom at gate 5&quot; or &quot;Leave with security at main entrance&quot;
                  </p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-6 h-6 text-brand-orange" />
                    <h2 className="text-xl font-semibold text-brand-black">Payment Method</h2>
                  </div>
                  {user && savedCards.length > 0 && (
                    <Link href="/account/payment-methods" className="text-sm text-brand-orange hover:underline">
                      Manage Cards
                    </Link>
                  )}
                </div>
                <div className="space-y-3">
                  {user && savedCards.length > 0 && (
                    <>
                      {savedCards.map((card) => (
                        <label key={card.id}
                          className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                            selectedCard === card.id && !useNewCard
                              ? 'border-brand-orange bg-brand-orange/5'
                              : 'border-gray-200 hover:border-brand-orange'
                          }`}
                        >
                          <input type="radio" name="savedCard" checked={selectedCard === card.id && !useNewCard}
                            onChange={() => { setSelectedCard(card.id); setUseNewCard(false); setFormData({ ...formData, paymentMethod: 'card' }); }}
                            className="w-5 h-5 text-brand-orange" />
                          <div className="flex items-center space-x-3 flex-1">
                            <CreditCard className="w-8 h-8 text-gray-600" />
                            <div>
                              <p className="font-semibold text-brand-black">{card.cardNumber}</p>
                              <p className="text-sm text-gray-600">Expires {card.expiryDate}</p>
                            </div>
                            {card.isDefault && (
                              <span className="ml-auto bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Default</span>
                            )}
                          </div>
                        </label>
                      ))}
                      <label className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                        useNewCard ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-brand-orange'
                      }`}>
                        <input type="radio" name="savedCard" checked={useNewCard}
                          onChange={() => { setUseNewCard(true); setSelectedCard(null); setFormData({ ...formData, paymentMethod: 'card' }); }}
                          className="w-5 h-5 text-brand-orange" />
                        <div className="flex items-center space-x-3">
                          <Plus className="w-8 h-8 text-brand-orange" />
                          <div>
                            <p className="font-semibold text-brand-black">Use New Card</p>
                            <p className="text-sm text-gray-600">Enter new card details at checkout</p>
                          </div>
                        </div>
                      </label>
                    </>
                  )}

                  {(!user || savedCards.length === 0) && (
                    <label className="flex items-center space-x-3 p-4 border-2 border-brand-orange rounded-xl cursor-pointer bg-brand-orange/5">
                      <input type="radio" name="payment" value="card" checked={formData.paymentMethod === 'card'}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="w-5 h-5 text-brand-orange" />
                      <div className="flex-1">
                        <p className="font-semibold text-brand-black">Credit / Debit Card (Paystack)</p>
                        <p className="text-sm text-gray-600">Pay securely with your card</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Out-of-range block above the button */}
              {addressOutOfRange && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-700">
                    Your delivery address is outside our service area. Please go back and select a closer location to continue.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                style={!canSubmit ? { pointerEvents: 'none' } : undefined}
                className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing…</span>
                  </span>
                ) : !locationTouched ? (
                  'Select a delivery address to continue'
                ) : addressOutOfRange ? (
                  'Address outside delivery zone'
                ) : (
                  `Continue to Payment (R${finalTotal.toFixed(2)})`
                )}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 sticky top-24">
              <h2 className="text-xl font-semibold text-brand-black mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={`${item.id}-${item.variantId || ''}`} className="flex items-center space-x-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-brand-black line-clamp-1">
                        {item.name}
                        {item.variantName && <span className="text-gray-500"> - {item.variantName}</span>}
                      </p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity} × R{item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-semibold text-brand-black">R{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* ── Promo Code ────────────────────────────────────────────── */}
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Tag className="w-4 h-4 text-brand-orange" />
                  <span className="text-sm font-semibold text-gray-700">Promo Code</span>
                </div>

                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
                    <div className="flex items-start space-x-2 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-green-900 font-mono">{appliedPromo.code}</p>
                        <p className="text-xs text-green-700">
                          {appliedPromo.type === 'free_delivery'
                            ? 'Free delivery applied'
                            : `R${appliedPromo.discountAmount.toFixed(2)} off applied`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg transition-colors flex-shrink-0"
                      aria-label="Remove promo code"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); if (promoError) setPromoError(''); }}
                        placeholder="Enter code"
                        className="input-field flex-1 font-mono uppercase"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={applyingPromo || !promoInput.trim()}
                        className="px-5 py-2 bg-brand-black text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {applyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {promoError && (
                      <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{promoError}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>R{total.toFixed(2)}</span>
                </div>
                {subtotalDiscount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Promo Discount</span>
                    <span>-R{subtotalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  {effectiveDeliveryFee === 0 && appliedPromo?.type === 'free_delivery' ? (
                    <span className="flex items-center gap-2">
                      <span className="line-through text-gray-400">R{deliveryFee.toFixed(2)}</span>
                      <span className="text-green-600 font-semibold">FREE</span>
                    </span>
                  ) : (
                    <span>R{effectiveDeliveryFee.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between text-xl font-bold text-brand-black border-t pt-3">
                  <span>Total</span>
                  <span className="text-brand-orange">R{finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}