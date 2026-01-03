'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice: number;
  images: string[];
  category: string;
}

export default function SpecialsSection() {
  const [specials, setSpecials] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecials();
  }, []);

  const fetchSpecials = async () => {
    try {
      const res = await fetch('/api/products?onSpecial=true&limit=8');
      if (res.ok) {
        const data = await res.json();
        setSpecials(data.products);
      }
    } catch (error) {
      console.error('Error fetching specials:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="section-padding bg-orange-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-brand-orange/10 px-4 py-2 rounded-full mb-4">
              <Tag className="w-5 h-5 text-brand-orange" />
              <span className="text-brand-orange font-semibold">SPECIAL OFFERS</span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-brand-black mb-4">
              Today's Hot Deals
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
                <div className="bg-gray-200 h-4 rounded mb-2"></div>
                <div className="bg-gray-200 h-4 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (specials.length === 0) {
    return null;
  }

  return (
    <section className="section-padding bg-orange-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-brand-orange/10 px-4 py-2 rounded-full mb-4">
            <Tag className="w-5 h-5 text-brand-orange" />
            <span className="text-brand-orange font-semibold">SPECIAL OFFERS</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl text-brand-black mb-4">
            Today's Hot Deals
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Limited time offers on your favorite products. Stock up and save big!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {specials.map((product, index) => (
            <div
              key={product._id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ProductCard product={product} showDiscount />
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/specials"
            className="inline-block bg-brand-orange text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-all transform hover:scale-105"
          >
            View All Specials
          </Link>
        </div>
      </div>
    </section>
  );
}
