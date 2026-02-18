'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { useCartStore } from '@/lib/store';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Home, ShoppingCart, Minus, Plus, Package, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
  product?: {
    _id: string;
    name: string;
    price: number;
    images: string[];
  };
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
  const { branch } = useBranch();
  const addItem = useCartStore((state) => state.addItem);
  const comboSlug = params.comboSlug as string;
  
  const [combo, setCombo] = useState<Combo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch && comboSlug) {
      fetchCombo();
    }
  }, [branch, comboSlug]);

  const fetchCombo = async () => {
    if (!branch) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/combos?slug=${comboSlug}&branchId=${branch.id}`);
      
      if (res.ok) {
        const data = await res.json();
        const foundCombo = data.combos?.[0];
        
        if (foundCombo) {
          // Fetch product details for each item
          const itemsWithProducts = await Promise.all(
            foundCombo.items.map(async (item: ComboItem) => {
              try {
                const productRes = await fetch(`/api/products/${item.productId}`);
                if (productRes.ok) {
                  const productData = await productRes.json();
                  return { ...item, product: productData.product };
                }
              } catch (error) {
                console.error('Failed to fetch product:', item.productId);
              }
              return item;
            })
          );
          
          setCombo({ ...foundCombo, items: itemsWithProducts });
        }
      }
    } catch (error) {
      console.error('Failed to fetch combo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!combo) {
      toast.error('Combo not available');
      return;
    }

    addItem({
      id: combo._id,
      name: combo.name,
      price: combo.comboPrice,
      image: combo.images[0] || '/placeholder.png',
      quantity: quantity,
      originalPrice: combo.regularPrice,
    });
    
    toast.success(`Added ${quantity}x ${combo.name} to cart!`);
  };

  const isInStock = combo && combo.stockLevel > 0;
  const maxQuantity = Math.min(combo?.stockLevel || 0, 99);
  const savings = combo ? combo.regularPrice - combo.comboPrice : 0;
  const discountPercent = combo ? Math.round((savings / combo.regularPrice) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-6 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-200 rounded-2xl h-96 animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!combo) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-black mb-4">
            Combo not found
          </h1>
          {branch && (
            <Link
              href={`/${branch.slug}/combos`}
              className="text-brand-orange hover:text-orange-600 font-semibold"
            >
              Back to Combos
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-8">
          <Link href={`/${branch?.slug}`} className="hover:text-brand-orange">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${branch?.slug}/combos`} className="hover:text-brand-orange">
            Combos
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-brand-black font-medium">{combo.name}</span>
        </nav>

        {/* Combo Details */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden mb-4">
              <div className="relative aspect-square">
                {combo.images[selectedImage] ? (
                  <Image
                    src={combo.images[selectedImage]}
                    alt={combo.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
                    <div className="text-center text-brand-orange">
                      <Package className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-sm font-semibold">COMBO DEAL</p>
                    </div>
                  </div>
                )}
                
                {/* Badge */}
                <div className="absolute top-4 left-4">
                  <span className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center space-x-2">
                    <Package className="w-4 h-4" />
                    <span>COMBO</span>
                  </span>
                </div>

                {discountPercent > 0 && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-brand-orange text-white px-4 py-2 rounded-full text-sm font-bold">
                      {discountPercent}% OFF
                    </span>
                  </div>
                )}

                {!isInStock && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-semibold block text-center">
                      OUT OF STOCK
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {combo.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {combo.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === idx
                        ? 'border-brand-orange'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${combo.name} ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Combo Info */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-4">
              {combo.name}
            </h1>

            {/* Description */}
            {combo.description && (
              <p className="text-gray-600 mb-6 whitespace-pre-line">
                {combo.description}
              </p>
            )}

            {/* What's Included */}
            <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>What's Included ({combo.items.length} items)</span>
              </h3>
              <ul className="space-y-2">
                {combo.items.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-purple-800">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x {item.productName}</span>
                      {item.product && (
                        <span className="text-sm text-purple-600 ml-2">
                          (R{item.product.price.toFixed(2)} each)
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Comparison */}
            <div className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Regular Price:</span>
                <span className="text-gray-400 line-through text-lg">
                  R{combo.regularPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-brand-black">Combo Price:</span>
                <span className="text-2xl font-bold text-brand-orange">
                  R{combo.comboPrice.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-orange-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-green-700">You Save:</span>
                  <span className="text-xl font-bold text-green-600">
                    R{savings.toFixed(2)} ({discountPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Stock Status */}
            <div className="mb-6">
              {isInStock ? (
                <p className="text-green-600 font-semibold flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                  <span>In Stock ({combo.stockLevel} available)</span>
                </p>
              ) : (
                <p className="text-red-600 font-semibold flex items-center space-x-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                  <span>Out of Stock</span>
                </p>
              )}
            </div>

            {/* Quantity + Add to Cart */}
            {isInStock && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">
                  Quantity
                </label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border-2 border-gray-200 rounded-xl">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-3 hover:bg-gray-50 transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 text-center font-semibold focus:outline-none"
                      min="1"
                      max={maxQuantity}
                    />
                    <button
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      className="p-3 hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-brand-orange text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Add Combo to Cart</span>
                  </button>
                </div>
              </div>
            )}

            {/* Individual Products */}
            {combo.items.some(item => item.product) && (
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-xl font-bold text-brand-black mb-4">Included Products</h2>
                <div className="grid grid-cols-2 gap-3">
                  {combo.items.map((item, idx) => item.product && (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-gray-200">
                      {item.product.images[0] && (
                        <div className="relative aspect-square mb-2 rounded-lg overflow-hidden">
                          <Image
                            src={item.product.images[0]}
                            alt={item.productName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <p className="font-semibold text-sm text-brand-black mb-1">
                        {item.quantity}x {item.productName}
                      </p>
                      <p className="text-xs text-gray-600">
                        R{item.product.price.toFixed(2)} each
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}