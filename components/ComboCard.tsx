'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';
import toast from 'react-hot-toast';

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
  const { branch } = useBranch();
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const savings         = combo.regularPrice - combo.comboPrice;
  const discountPercent = Math.round((savings / combo.regularPrice) * 100);
  const inStock         = combo.stockLevel > 0;
  const lowStock        = combo.stockLevel < 10 && combo.stockLevel > 0;
  const hasBanner       = savings > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: combo._id,
      name: combo.name,
      price: combo.comboPrice,
      image: combo.images[0] || '/placeholder.png',
      quantity,
      sku: combo.slug,
      originalPrice: combo.regularPrice,
      isCombo: true,
      comboItemCount: combo.items.length,
    });
    toast.success(`${quantity} ${combo.name} added to your cart`);
    setQuantity(1);
  };

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity < combo.stockLevel) setQuantity((q) => q + 1);
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > 1) setQuantity((q) => q - 1);
  };

  const comboUrl = branch ? `/${branch.slug}/combos/${combo.slug}` : `/combos/${combo.slug}`;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <Link href={comboUrl} className="block">
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
          {combo.images[0] && !imgError ? (
            <img
              src={combo.images[0]}
              alt={combo.name}
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-orange-50">
              <Package className="w-10 h-10 text-brand-orange" />
            </div>
          )}

          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              COMBO
            </span>
            {discountPercent > 0 && (
              <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                -{discountPercent}%
              </span>
            )}
          </div>

          <div className="absolute bottom-2 left-2">
            <span className="bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              {combo.items.length} items
            </span>
          </div>

          {lowStock && (
            <div className="absolute bottom-2 right-2">
              <span className="bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                {combo.stockLevel} left
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        <Link href={comboUrl}>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 min-h-[2.375rem] hover:text-brand-orange transition-colors">
            {combo.name}
          </h3>
          <p className="text-[11px] text-gray-500 line-clamp-2 mb-2 min-h-[1.75rem]">
            {combo.description}
          </p>
        </Link>

        <div className="min-h-[5rem] flex flex-col justify-start mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-lg font-bold text-brand-orange">
              R{combo.comboPrice.toFixed(2)}
            </span>
          </div>

          {hasBanner && (
            <div className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5">
              <p className="text-[10px] text-purple-700 font-semibold truncate">
                Bundle Deal — Save R{savings.toFixed(2)}!
              </p>
            </div>
          )}

          {!hasBanner && <div className="h-[1.625rem]" />}
        </div>

        {inStock ? (
          <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="px-3 text-sm font-semibold text-gray-800 min-w-[2rem] text-center">
                {quantity}
              </span>
              <button
                onClick={incrementQuantity}
                disabled={quantity >= combo.stockLevel}
                className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 flex items-center justify-center space-x-1 bg-brand-orange hover:bg-orange-600 text-white py-2 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="font-semibold text-xs md:text-sm">Add</span>
            </button>
          </div>
        ) : (
          <div className="bg-gray-200 py-2 rounded-lg text-center">
            <span className="text-gray-600 text-xs font-semibold">Out of Stock</span>
          </div>
        )}
      </div>
    </div>
  );
}