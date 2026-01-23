'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';

interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface ComboCardProps {
  combo: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    items: ComboItem[];
    comboPrice: number;
    regularPrice: number;
    images: string[];
    stockLevel: number;
  };
}

export default function ComboCard({ combo }: ComboCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const savings = combo.regularPrice - combo.comboPrice;
  const discountPercent = Math.round((savings / combo.regularPrice) * 100);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: combo._id,
      name: combo.name,
      price: combo.comboPrice,
      image: combo.images[0] || '/placeholder.png',
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
    if (quantity < combo.stockLevel) {
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
      href={`/combos/${combo.slug}`}
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
        {combo.images[0] && !imgError ? (
          <img
            src={combo.images[0]}
            alt={combo.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
            <div className="text-center text-brand-orange">
              <Package className="w-12 h-12 mx-auto mb-2" />
              <p className="text-xs font-semibold">COMBO</p>
            </div>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            COMBO
          </span>
          {discountPercent > 0 && (
            <span className="bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Stock Warning */}
        {combo.stockLevel < 10 && combo.stockLevel > 0 && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {combo.stockLevel} left
            </span>
          </div>
        )}

        {/* Items Count Badge */}
        <div className="absolute bottom-2 right-2">
          <span className="bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">
            {combo.items.length} items
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-semibold text-brand-black mb-2 line-clamp-2 group-hover:text-brand-orange transition-colors">
          {combo.name}
        </h3>

        {/* Price */}
        <div className="mb-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-lg md:text-xl font-bold text-brand-orange">
              R{combo.comboPrice.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 line-through">
              R{combo.regularPrice.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-green-600 font-semibold mt-0.5">
            Save R{savings.toFixed(2)}
          </p>
        </div>

        {/* Quantity + Add to Cart */}
        {combo.stockLevel > 0 ? (
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
                disabled={quantity >= combo.stockLevel}
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