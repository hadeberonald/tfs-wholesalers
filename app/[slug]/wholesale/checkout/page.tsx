'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Package, FileText, Truck, CreditCard } from 'lucide-react';
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

export default function WholesaleCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [user, setUser] = useState<any>(null);
  const [wholesaleCustomer, setWholesaleCustomer] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(200);
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState<'account' | 'eft' | 'cash'>('cash');
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
        
        // Fetch wholesale customer profile
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
    if (stored) {
      setCart(JSON.parse(stored));
    }
  };

  const removeFromCart = (id: string, variantId?: string) => {
    const newCart = cart.filter(item => 
      !(item.id === id && item.variantId === variantId)
    );
    setCart(newCart);
    localStorage.setItem('wholesale-cart', JSON.stringify(newCart));
    toast.success('Removed from cart');
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getTotalUnits = () => {
    return cart.reduce((sum, item) => sum + item.totalUnits, 0);
  };

  const handleSubmitOrder = async () => {
    if (!wholesaleCustomer) {
      toast.error('Wholesale account not found');
      return;
    }

    if (wholesaleCustomer.verificationStatus !== 'approved') {
      toast.error('Your wholesale account is pending approval');
      router.push(`/${slug}/wholesale/pending`);
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);

    try {
      const orderData = {
        customerId: wholesaleCustomer._id,
        items: cart.map(item => ({
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
        paymentMethod,
        customerNotes,
      };

      const res = await fetch('/api/wholesale/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Purchase Order ${data.poNumber} created!`);
        
        // Clear cart
        localStorage.removeItem('wholesale-cart');
        setCart([]);
        
        router.push(`/${slug}/wholesale/orders`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const vat = subtotal * 0.15;
  const total = subtotal + vat + deliveryFee;

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-brand-black mb-8">
          Wholesale Checkout
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cart Items */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center space-x-2">
                <ShoppingCart className="w-6 h-6" />
                <span>Order Items ({cart.length})</span>
              </h2>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-brand-black">
                          {item.name}
                          {item.variantName && (
                            <span className="text-gray-600 font-normal"> - {item.variantName}</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {item.quantity} {item.moqUnit} = {item.totalUnits} units
                        </p>
                        <p className="text-sm text-gray-600">
                          R{item.unitPrice.toFixed(2)} per unit
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-brand-orange">
                          R{item.totalPrice.toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.id, item.variantId)}
                          className="text-red-600 hover:text-red-700 text-sm mt-2 flex items-center space-x-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center space-x-2">
                <Truck className="w-6 h-6" />
                <span>Delivery Address</span>
              </h2>

              {wholesaleCustomer?.businessAddress && (
                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                  <p className="font-semibold text-brand-black mb-2">
                    {wholesaleCustomer.businessName}
                  </p>
                  <p className="text-gray-600">{wholesaleCustomer.businessAddress.street}</p>
                  <p className="text-gray-600">
                    {wholesaleCustomer.businessAddress.city}, {wholesaleCustomer.businessAddress.province} {wholesaleCustomer.businessAddress.postalCode}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Notes
                </label>
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
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center space-x-2">
                <CreditCard className="w-6 h-6" />
                <span>Payment Method</span>
              </h2>

              <div className="space-y-3">
                {wholesaleCustomer?.creditTerms && (
                  <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="account"
                      checked={paymentMethod === 'account'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-5 h-5 text-brand-orange"
                    />
                    <div>
                      <p className="font-semibold text-brand-black">Account</p>
                      <p className="text-sm text-gray-600">
                        Payment due in {wholesaleCustomer.creditTerms}
                      </p>
                    </div>
                  </label>
                )}

                <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="eft"
                    checked={paymentMethod === 'eft'}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-5 h-5 text-brand-orange"
                  />
                  <div>
                    <p className="font-semibold text-brand-black">EFT</p>
                    <p className="text-sm text-gray-600">Electronic Funds Transfer</p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-5 h-5 text-brand-orange"
                  />
                  <div>
                    <p className="font-semibold text-brand-black">Cash on Delivery</p>
                    <p className="text-sm text-gray-600">Pay when order is delivered</p>
                  </div>
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Notes
                </label>
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
              <h2 className="text-xl font-bold text-brand-black mb-4 flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>Order Summary</span>
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Total Units:</span>
                  <span className="font-semibold">{getTotalUnits()}</span>
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

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-xl font-bold text-brand-black">
                    <span>Total:</span>
                    <span className="text-brand-orange">R{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Lead Time:</span> {leadTimeDays} business days
                  </p>
                </div>

                {wholesaleCustomer?.creditTerms && paymentMethod === 'account' && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-900">
                      <span className="font-semibold">Payment Terms:</span> {wholesaleCustomer.creditTerms}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submitting || cart.length === 0}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Purchase Order'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                By submitting, you agree to our wholesale terms and conditions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}