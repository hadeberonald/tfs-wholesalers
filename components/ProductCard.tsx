'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    specialPrice?: number;
    images: string[];
    category: string;
  };
  showDiscount?: boolean;
}

export default function ProductCard({ product, showDiscount }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const displayPrice = product.specialPrice || product.price;
  const hasDiscount = product.specialPrice && product.specialPrice < product.price;
  const discountPercent = hasDiscount 
    ? Math.round(((product.price - product.specialPrice!) / product.price) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      productId: product._id,
      name: product.name,
      price: displayPrice,
      quantity: 1,
      image: product.images[0] || '/placeholder-product.png',
      sku: product._id,
    });
    toast.success('Added to cart!');
  };

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {hasDiscount && showDiscount && (
            <div className="absolute top-3 left-3 z-10 bg-brand-orange text-white px-3 py-1 rounded-full text-sm font-bold">
              -{discountPercent}%
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.preventDefault();
              toast('Wishlist coming soon!');
            }}
            className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-all opacity-0 group-hover:opacity-100"
          >
            <Heart className="w-5 h-5 text-gray-700" />
          </button>

          <img
            src={product.images[0] || '/placeholder-product.png'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm text-gray-500 mb-1">{product.category}</p>
          <h3 className="font-semibold text-lg text-brand-black mb-3 line-clamp-2 group-hover:text-brand-orange transition-colors">
            {product.name}
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-brand-orange">
                  R{displayPrice.toFixed(2)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-gray-400 line-through">
                    R{product.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="bg-brand-orange text-white p-3 rounded-xl hover:bg-orange-600 transition-all transform hover:scale-110 active:scale-95"
              aria-label="Add to cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
