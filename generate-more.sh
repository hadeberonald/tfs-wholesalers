#!/bin/bash

BASE_DIR="/home/claude/tfs-wholesalers"

echo "Creating admin portal and checkout pages..."

# Admin Dashboard Page
cat > "$BASE_DIR/app/admin/page.tsx" << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Users, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-brand-black mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your wholesale platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalOrders}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Revenue</p>
            <p className="text-3xl font-bold text-brand-black">R{stats.totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-1">Products</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalProducts}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Users className="w-6 h-6 text-brand-orange" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-1">Customers</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalCustomers}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/products" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Products</h3>
            <p className="text-gray-600">Manage your product catalog</p>
          </Link>

          <Link href="/admin/orders" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <ShoppingBag className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Orders</h3>
            <p className="text-gray-600">View and manage orders</p>
          </Link>

          <Link href="/admin/users" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Users className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Users</h3>
            <p className="text-gray-600">Manage customers and pickers</p>
          </Link>

          <Link href="/admin/categories" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Categories</h3>
            <p className="text-gray-600">Organize your products</p>
          </Link>

          <Link href="/admin/hero-banners" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Hero Banners</h3>
            <p className="text-gray-600">Manage homepage banners</p>
          </Link>

          <Link href="/admin/settings" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Settings</h3>
            <p className="text-gray-600">Delivery pricing and more</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
EOF

# Checkout Page
cat > "$BASE_DIR/app/checkout/page.tsx" << 'EOF'
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
EOF

# Products List Page
cat > "$BASE_DIR/app/products/page.tsx" << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import { Search } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product: any) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-20 section-padding">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-display text-4xl md:text-5xl text-brand-black mb-8">All Products</h1>

        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="input-field pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
                <div className="bg-gray-200 h-4 rounded mb-2"></div>
                <div className="bg-gray-200 h-4 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
EOF

# Orders API Route
cat > "$BASE_DIR/app/api/orders/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { generateOrderNumber } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const orders = await db
      .collection('orders')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const order = {
      orderNumber: generateOrderNumber(),
      ...body,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      deliveryFee: 35,
      subtotal: body.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    order.total = order.subtotal + order.deliveryFee;

    const result = await db.collection('orders').insertOne(order);
    return NextResponse.json({ orderId: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
EOF

echo "Admin, checkout, and additional pages created!"
