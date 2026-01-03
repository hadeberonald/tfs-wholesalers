#!/bin/bash

# This script generates all remaining components and API routes for TFS Wholesalers

BASE_DIR="/home/claude/tfs-wholesalers"

echo "Generating remaining project files..."

# Create Categories Section Component
cat > "$BASE_DIR/components/home/CategoriesSection.tsx" << 'EOF'
'use client';

import Link from 'next/link';
import { Package, Home, Sparkles, Utensils } from 'lucide-react';

const categories = [
  { name: 'Groceries', icon: Utensils, slug: 'groceries', color: 'from-green-400 to-green-600' },
  { name: 'Home Supplies', icon: Home, slug: 'home-supplies', color: 'from-blue-400 to-blue-600' },
  { name: 'Appliances', icon: Package, slug: 'appliances', color: 'from-purple-400 to-purple-600' },
  { name: 'Cleaning', icon: Sparkles, slug: 'cleaning', color: 'from-pink-400 to-pink-600' },
];

export default function CategoriesSection() {
  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl text-brand-black mb-4">
            Shop by Category
          </h2>
          <p className="text-gray-600 text-lg">
            Find exactly what you need for your business
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="group"
              >
                <div className="bg-white rounded-2xl p-8 text-center card-hover">
                  <div className={`w-20 h-20 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-semibold text-xl text-brand-black group-hover:text-brand-orange transition-colors">
                    {category.name}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
EOF

# Create Featured Products Component
cat > "$BASE_DIR/components/home/FeaturedProducts.tsx" << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';

export default function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products?featured=true&limit=8')
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl text-brand-black mb-4">
            Featured Products
          </h2>
          <p className="text-gray-600 text-lg">
            Handpicked essentials for your business
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
EOF

# Create Why Choose Us Component
cat > "$BASE_DIR/components/home/WhyChooseUs.tsx" << 'EOF'
import { Truck, Shield, Clock, Tag } from 'lucide-react';

const features = [
  {
    icon: Tag,
    title: 'Wholesale Prices',
    description: 'Competitive pricing on bulk orders for maximum savings'
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: 'Quick and reliable delivery across the region'
  },
  {
    icon: Shield,
    title: 'Quality Assured',
    description: 'Only the best products from trusted suppliers'
  },
  {
    icon: Clock,
    title: '24/7 Support',
    description: 'Our team is always here to help you'
  }
];

export default function WhyChooseUs() {
  return (
    <section className="section-padding bg-brand-black text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl mb-4">
            Why Choose TFS Wholesalers
          </h2>
          <p className="text-gray-300 text-lg">
            Your trusted partner for wholesale success
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="text-center">
                <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
EOF

# Create Products API Route
cat > "$BASE_DIR/app/api/products/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const onSpecial = searchParams.get('onSpecial');
    const featured = searchParams.get('featured');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = { active: true };
    if (category) query.category = category;
    if (onSpecial === 'true') query.onSpecial = true;
    if (featured === 'true') query.featured = true;

    const skip = (page - 1) * limit;

    const products = await db
      .collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('products').countDocuments(query);

    return NextResponse.json({
      products,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const product = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
EOF

# Create Cart Page
cat > "$BASE_DIR/app/cart/page.tsx" << 'EOF'
'use client';

import { useCartStore } from '@/lib/store';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, subtotal, deliveryFee, total, updateQuantity, removeItem } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <h1 className="font-display text-4xl text-brand-black mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-8">Start shopping to add items to your cart</p>
          <Link href="/products" className="btn-primary">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 section-padding">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-display text-4xl md:text-5xl text-brand-black mb-8">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-2xl p-6 flex items-center space-x-4">
                  <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-xl" />
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-brand-black">{item.name}</h3>
                    <p className="text-brand-orange font-bold text-xl">R{item.price.toFixed(2)}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-semibold w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      removeItem(item.productId);
                      toast.success('Removed from cart');
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-2xl text-brand-black mb-6">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">R{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-semibold">
                    {deliveryFee > 0 ? `R${deliveryFee.toFixed(2)}` : 'Calculated at checkout'}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-2xl text-brand-orange">R{total.toFixed(2)}</span>
                </div>
              </div>

              <Link href="/checkout" className="btn-primary w-full block text-center mb-3">
                Proceed to Checkout
              </Link>
              <Link href="/products" className="btn-secondary w-full block text-center">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

echo "Main components and API routes created successfully!"
