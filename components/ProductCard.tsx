'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    specialPrice?: number;
    compareAtPrice?: number;
    images: string[];
    stockLevel: number;
    onSpecial?: boolean;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const displayPrice = product.specialPrice || product.price;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > displayPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - displayPrice) / product.compareAtPrice!) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product._id,
      name: product.name,
      price: displayPrice,
      image: product.images[0] || '/placeholder.png',
      quantity: quantity,
    });
    
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setQuantity(1);
    }, 1500);
  };

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    if (quantity < product.stockLevel) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 relative"
    >
      {/* Added Animation */}
      {justAdded && (
        <div className="absolute inset-0 bg-green-500/90 z-20 flex items-center justify-center animate-fade-in">
          <div className="text-center">
            <Check className="w-12 h-12 text-white mx-auto mb-2" />
            <p className="text-white font-semibold">Added!</p>
          </div>
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {product.images[0] && !imgError ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2" />
              <p className="text-xs">No Image</p>
            </div>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {product.onSpecial && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              SPECIAL
            </span>
          )}
          {hasDiscount && (
            <span className="bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Stock Warning */}
        {product.stockLevel < 10 && product.stockLevel > 0 && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {product.stockLevel} left
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-semibold text-brand-black mb-2 line-clamp-2 group-hover:text-brand-orange transition-colors">
          {product.name}
        </h3>

        {/* Price */}
        <div className="mb-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-lg md:text-xl font-bold text-brand-orange">
              R{displayPrice.toFixed(2)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > displayPrice && (
              <span className="text-xs text-gray-500 line-through">
                R{product.compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Quantity + Add to Cart */}
        {product.stockLevel > 0 ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={decrementQuantity}
                className="p-1.5 hover:bg-gray-100 transition-colors"
                disabled={quantity <= 1}
              >
                <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
              <span className="px-2 md:px-3 font-semibold text-brand-black text-sm">{quantity}</span>
              <button
                onClick={incrementQuantity}
                className="p-1.5 hover:bg-gray-100 transition-colors"
                disabled={quantity >= product.stockLevel}
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 flex items-center justify-center space-x-1 bg-brand-orange hover:bg-orange-600 text-white py-2 px-2 md:px-3 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-semibold text-xs md:text-sm">Add</span>
            </button>
          </div>
        ) : (
          <button
            disabled
            className="w-full py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed text-xs md:text-sm"
          >
            Out of Stock
          </button>
        )}
      </div>
    </Link>
  );
}