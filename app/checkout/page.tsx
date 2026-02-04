'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCartStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { ShoppingBag, User, MapPin, CreditCard, Loader2, Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

// Dynamically import the NEW Google Maps component
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

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, getTotal } = useCartStore();
  const total = getTotal();
  const [checkoutAs, setCheckoutAs] = useState<'guest' | 'user' | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<any>(null);
  const [storeLocation, setStoreLocation] = useState({ lat: -27.763912, lng: 30.798969 });
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [locationValid, setLocationValid] = useState(false);
  
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
    fetchSettings();
    
    // Load Paystack script
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [items, router]);

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
        if (defaultCard) {
          setSelectedCard(defaultCard.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch saved cards:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setDeliverySettings(data.settings);
          setDeliveryFee(data.settings.medium || 85);
        }
        if (data.location) {
          setStoreLocation(data.location);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setDeliveryFee(85);
      setDeliverySettings({
        local: 35,
        localRadius: 20,
        medium: 85,
        mediumRadius: 40,
        far: 105,
        farRadius: 60,
      });
    }
  };

  const handleLocationSelect = (locationData: {
    lat: number;
    lng: number;
    address: string;
    distance: number;
    deliveryFee: number;
  }) => {
    setFormData({
      ...formData,
      address: locationData.address,
      lat: locationData.lat,
      lng: locationData.lng,
    });
    setDeliveryFee(locationData.deliveryFee);
    setLocationValid(locationData.distance <= 60);
  };

  const finalTotal = total + deliveryFee;

  const promoteOrderToPending = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      if (!res.ok) {
        console.error('❌ Failed to promote order to pending:', await res.json());
      } else {
        console.log('✅ Order promoted to pending — now visible to pickers');
      }
    } catch (error) {
      console.error('❌ Error promoting order:', error);
    }
  };

  const handlePaystackPayment = async (orderId: string, orderData: any) => {
    console.log('💳 Initializing Paystack payment...');
    
    try {
      const savedCardData = selectedCard && !useNewCard 
        ? savedCards.find(c => c.id === selectedCard)
        : null;

      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          email: orderData.customerInfo.email,
          amount: orderData.total,
          authorizationCode: savedCardData?.authorizationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      console.log('✅ Payment initialized:', data.reference);

      if (savedCardData?.authorizationCode && data.charged) {
        console.log('✅ Charged with saved card');
        await verifyPayment(data.reference, orderId);
        return;
      }

      if (!(window as any).PaystackPop) {
        throw new Error('Paystack not loaded');
      }

      const handler = (window as any).PaystackPop.setup({
        key: data.publicKey,
        email: orderData.customerInfo.email,
        amount: Math.round(orderData.total * 100),
        currency: 'ZAR',
        ref: data.reference,
        callback: function(response: any) {
          console.log('✅ Payment successful:', response.reference);
          
          if (user && useNewCard && response.authorization) {
            savePaymentMethod(response.authorization);
          }
          
          verifyPayment(response.reference, orderId);
        },
        onClose: function() {
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

  const verifyPayment = async (reference: string, orderId: string) => {
    console.log('🔍 Verifying payment:', reference);
    
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        console.log('✅ Payment verified successfully');
        await promoteOrderToPending(orderId);
        toast.success('Payment successful!');
        router.push(`/checkout/success/${orderId}`);
      } else {
        console.error('❌ Verification failed:', data);
        throw new Error('Payment verification failed');
      }
    } catch (error) {
      console.error('❌ Verification error:', error);
      setLoading(false);
      toast.error('Payment verification failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!locationValid) {
      toast.error('Please select a delivery location within our service area');
      return;
    }
    
    if (formData.paymentMethod === 'card' && user && savedCards.length > 0 && !selectedCard && !useNewCard) {
      toast.error('Please select a payment method');
      return;
    }
    
    setLoading(true);
    console.log('📦 Creating order...');

    try {
      const orderData = {
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
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        subtotal: total,
        deliveryFee: deliveryFee,
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
          setTimeout(() => {
            handlePaystackPayment(data.orderId, orderData);
          }, 500);
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

  if (items.length === 0) {
    return null;
  }

  if (!checkoutAs) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <ShoppingBag className="w-16 h-16 text-brand-orange mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-brand-black mb-2">Checkout</h1>
            <p className="text-gray-600">How would you like to proceed?</p>
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
                href={`/login?redirect=/checkout`}
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

  return (
    <>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-brand-black mb-2">Checkout</h1>
            <p className="text-gray-600">Complete your order details</p>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        className="input-field"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        className="input-field"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g., 082 123 4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address with NEW Google Maps */}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City (Optional)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Durban"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code (Optional)
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="4001"
                      />
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Notes (Optional)
                    </label>
                    <textarea
                      rows={4}
                      className="input-field"
                      value={formData.deliveryNotes}
                      onChange={(e) => setFormData({ ...formData, deliveryNotes: e.target.value })}
                      placeholder="Please give us any delivery instructions or specific directions to find you easily..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Example: "Ring the intercom at gate 5" or "Leave with security at main entrance"
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
                          <label
                            key={card.id}
                            className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                              selectedCard === card.id && !useNewCard
                                ? 'border-brand-orange bg-brand-orange/5'
                                : 'border-gray-200 hover:border-brand-orange'
                            }`}
                          >
                            <input
                              type="radio"
                              name="savedCard"
                              checked={selectedCard === card.id && !useNewCard}
                              onChange={() => {
                                setSelectedCard(card.id);
                                setUseNewCard(false);
                                setFormData({ ...formData, paymentMethod: 'card' });
                              }}
                              className="w-5 h-5 text-brand-orange"
                            />
                            <div className="flex items-center space-x-3 flex-1">
                              <CreditCard className="w-8 h-8 text-gray-600" />
                              <div>
                                <p className="font-semibold text-brand-black">{card.cardNumber}</p>
                                <p className="text-sm text-gray-600">Expires {card.expiryDate}</p>
                              </div>
                              {card.isDefault && (
                                <span className="ml-auto bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                          </label>
                        ))}

                        <label
                          className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                            useNewCard
                              ? 'border-brand-orange bg-brand-orange/5'
                              : 'border-gray-200 hover:border-brand-orange'
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedCard"
                            checked={useNewCard}
                            onChange={() => {
                              setUseNewCard(true);
                              setSelectedCard(null);
                              setFormData({ ...formData, paymentMethod: 'card' });
                            }}
                            className="w-5 h-5 text-brand-orange"
                          />
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
                        <input
                          type="radio"
                          name="payment"
                          value="card"
                          checked={formData.paymentMethod === 'card'}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-5 h-5 text-brand-orange"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-brand-black">Credit / Debit Card (Paystack)</p>
                          <p className="text-sm text-gray-600">Pay securely with your card</p>
                        </div>
                      </label>
                    )}

                    <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors opacity-50">
                      <input
                        type="radio"
                        name="payment"
                        value="eft"
                        disabled
                        className="w-5 h-5 text-brand-orange"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-brand-black">EFT / Bank Transfer</p>
                        <p className="text-sm text-gray-600">Coming Soon</p>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !locationValid}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </span>
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
                    <div key={item.id} className="flex items-center space-x-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-brand-black line-clamp-1">{item.name}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity} × R{item.price.toFixed(2)}</p>
                      </div>
                      <p className="font-semibold text-brand-black">
                        R{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>R{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span>R{deliveryFee.toFixed(2)}</span>
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
    </>
  );
}