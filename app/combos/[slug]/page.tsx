'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Plus, Minus, Package, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import Link from 'next/link';

interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: ComboItem[];
  comboPrice: number;
  regularPrice: number;
  images: string[];
  stockLevel: number;
  active: boolean;
}

export default function ComboDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [combo, setCombo] = useState<Combo | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    fetchCombo();
  }, [params.slug]);

  const fetchCombo = async () => {
    try {
      const res = await fetch(`/api/combos?slug=${params.slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data.combos && data.combos.length > 0) {
          setCombo(data.combos[0]);
        } else {
          router.push('/specials');
        }
      }
    } catch (error) {
      console.error('Failed to fetch combo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!combo) return;
    
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
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Package className="w-12 h-12 text-gray-300 animate-pulse" />
      </div>
    );
  }

  if (!combo) {
    return null;
  }

  const savings = combo.regularPrice - combo.comboPrice;
  const discountPercent = Math.round((savings / combo.regularPrice) * 100);

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href="/specials"
          className="inline-flex items-center text-brand-orange hover:text-orange-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Specials
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                {combo.images[0] ? (
                  <img
                    src={combo.images[0]}
                    alt={combo.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-brand-orange">
                    <Package className="w-24 h-24 mx-auto mb-4" />
                    <p className="text-xl font-semibold">COMBO DEAL</p>
                  </div>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center space-x-3">
              <span className="bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-full">
                COMBO DEAL
              </span>
              <span className="bg-brand-orange text-white text-sm font-bold px-4 py-2 rounded-full">
                SAVE {discountPercent}%
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-4">
              {combo.name}
            </h1>

            <p className="text-gray-600 mb-6 text-lg">
              {combo.description}
            </p>

            {/* Pricing */}
            <div className="bg-orange-50 rounded-xl p-6 mb-6">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-gray-600">Regular Price:</span>
                <span className="text-xl text-gray-500 line-through">
                  R{combo.regularPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-gray-600">You Save:</span>
                <span className="text-xl text-green-600 font-bold">
                  R{savings.toFixed(2)} ({discountPercent}%)
                </span>
              </div>
              <div className="border-t border-orange-200 pt-3 mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-gray-900">Combo Price:</span>
                  <span className="text-3xl font-bold text-brand-orange">
                    R{combo.comboPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* What's Included */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-brand-black mb-4">
                What's Included ({combo.items.length} items)
              </h2>
              <div className="space-y-3">
                {combo.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center font-bold">
                        {item.quantity}×
                      </div>
                      <span className="font-medium text-gray-900">{item.productName}</span>
                    </div>
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Stock Status */}
            {combo.stockLevel > 0 && combo.stockLevel < 10 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-yellow-800 text-sm font-semibold">
                  Only {combo.stockLevel} combos left in stock!
                </p>
              </div>
            )}

            {/* Add to Cart Section */}
            {combo.stockLevel > 0 ? (
              <div>
                <div className="flex items-center space-x-4 mb-4">
                  <span className="text-gray-700 font-medium">Quantity:</span>
                  <div className="flex items-center border-2 border-gray-300 rounded-lg">
                    <button
                      onClick={() => quantity > 1 && setQuantity(q => q - 1)}
                      className="p-3 hover:bg-gray-100 transition-colors"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="px-6 font-bold text-lg text-brand-black">{quantity}</span>
                    <button
                      onClick={() => quantity < combo.stockLevel && setQuantity(q => q + 1)}
                      className="p-3 hover:bg-gray-100 transition-colors"
                      disabled={quantity >= combo.stockLevel}
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="w-full btn-primary flex items-center justify-center space-x-3 text-lg py-4"
                >
                  {justAdded ? (
                    <>
                      <Check className="w-6 h-6" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-6 h-6" />
                      <span>Add to Cart - R{(combo.comboPrice * quantity).toFixed(2)}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-semibold">Out of Stock</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}