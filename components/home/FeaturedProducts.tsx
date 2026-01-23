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
  featured: boolean;
}

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const res = await fetch('/api/products?featured=true&limit=6');
      if (res.ok) {
        const data = await res.json();
        // Only show active products
        const activeProducts = (data.products || []).filter((p: Product) => p.active);
        setProducts(activeProducts);
      }
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show section if no featured products
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-black">
            Featured Products
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}