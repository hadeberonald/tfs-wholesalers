'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';


interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  onSpecial?: boolean;
  active: boolean;
}

export default function SpecialsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecials();
  }, []);

  const fetchSpecials = async () => {
    try {
      const res = await fetch('/api/products?special=true&limit=3');
      if (res.ok) {
        const data = await res.json();
        // Only show active products with valid stock
        const activeSpecials = (data.products || []).filter(
          (p: Product) => p.active && p.stockLevel > 0
        );
        setProducts(activeSpecials);
      }
    } catch (error) {
      console.error('Failed to fetch specials:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show section if no specials and not loading
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-center mb-12">
          
          <h2 className="text-3xl md:text-4xl font-bold text-brand-black">
            Special Offers
          </h2>
        </div>

        {loading ? (
          // Change grid to:
<div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          // Change grid to:
<div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}