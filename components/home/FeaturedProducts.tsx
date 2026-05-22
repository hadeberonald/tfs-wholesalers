'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import ProductCard from '@/components/ProductCard';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  active: boolean;
  onSpecial?: boolean;
  hasVariants?: boolean;
  variants?: any[];
}

export default function FeaturedProducts() {
  const { branch } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (branch) fetchFeaturedProducts();
  }, [branch]);

  const fetchFeaturedProducts = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/products?branchId=${branch.id}&featured=true`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-8 w-52 bg-gray-200 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded-xl animate-pulse mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-brand-black mb-2">Featured Products</h2>
            <p className="text-gray-600">Check out our top picks for you</p>
          </div>
          {branch && (
            <Link
              href={`/${branch.slug}/shop`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange hover:text-orange-600 transition-colors whitespace-nowrap"
            >
              View All <ChevronRight className="w-5 h-5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}