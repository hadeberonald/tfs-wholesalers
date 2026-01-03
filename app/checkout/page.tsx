'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { MapPin, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, deliveryFee, total, setDeliveryFee, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
    paymentMethod: 'paystack'
  });

  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerInfo: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone
          },
          deliveryAddress: {
            street: formData.street,
            city: formData.city,
            province: formData.province,
            postalCode: formData.postalCode
          },
          items,
          paymentMethod: formData.paymentMethod
        })
      });

      if (response.ok) {
        const data = await response.json();
        clearCart();
        toast.success('Order placed successfully!');
        router.push(`/account/orders/${data.orderId}`);
      } else {
        toast.error('Failed to place order');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 section-padding">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl text-brand-black mb-8">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-2xl p-8">
            <h2 className="font-display text-2xl text-brand-black mb-6 flex items-center">
              <MapPin className="w-6 h-6 mr-2 text-brand-orange" />
              Delivery Information
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  required
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.street}
                  onChange={(e) => setFormData({...formData, street: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.province}
                  onChange={(e) => setFormData({...formData, province: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8">
            <h2 className="font-display text-2xl text-brand-black mb-6 flex items-center">
              <CreditCard className="w-6 h-6 mr-2 text-brand-orange" />
              Payment Method
            </h2>

            <div className="space-y-3">
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="paystack"
                  checked={formData.paymentMethod === 'paystack'}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold">Paystack (Card Payment)</p>
                  <p className="text-sm text-gray-600">Pay securely with your card</p>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="ozow"
                  checked={formData.paymentMethod === 'ozow'}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold">Ozow (Instant EFT)</p>
                  <p className="text-sm text-gray-600">Pay directly from your bank</p>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={formData.paymentMethod === 'cash'}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold">Cash on Delivery</p>
                  <p className="text-sm text-gray-600">Pay when you receive your order</p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8">
            <h3 className="font-display text-2xl text-brand-black mb-6">Order Summary</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="font-semibold">R{deliveryFee.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl text-brand-orange">R{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
