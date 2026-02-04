'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Plus, Minus, Loader2, Package } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  sku: string;
  category: string;
  unit?: string;
  weight?: number;
  onSpecial?: boolean;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [imgErrors, setImgErrors] = useState<boolean[]>([]);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (params.slug) {
      fetchProduct(params.slug as string);
    }
  }, [params.slug]);

  const fetchProduct = async (slug: string) => {
    try {
      const res = await fetch(`/api/products?slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          setProduct(data.products[0]);
          setImgErrors(new Array(data.products[0].images.length).fill(false));
        } else {
          router.push('/products');
        }
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      router.push('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (index: number) => {
    setImgErrors(prev => {
      const newErrors = [...prev];
      newErrors[index] = true;
      return newErrors;
    });
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    const displayPrice = product.specialPrice || product.price;
    addItem({
      id: product._id,
      name: product.name,
      price: displayPrice,
      image: product.images[0] || '/placeholder.png',
      quantity: quantity,
    });
    toast.success(`Added ${quantity}x ${product.name} to cart`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const displayPrice = product.specialPrice || product.price;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > displayPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - displayPrice) / product.compareAtPrice!) * 100)
    : 0;

  const validImages = product.images.filter((_, index) => !imgErrors[index]);
  const hasValidImages = validImages.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link
          href="/shop"
          className="inline-flex items-center text-brand-orange hover:text-orange-600 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Products
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="bg-white rounded-xl p-4 mb-3">
              <div className="aspect-square relative">
                {hasValidImages && !imgErrors[selectedImage] ? (
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    onError={() => handleImageError(selectedImage)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Package className="w-20 h-20 mx-auto mb-3" />
                      <p>No Image Available</p>
                    </div>
                  </div>
                )}
                {product.onSpecial && (
                  <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    SPECIAL
                  </span>
                )}
                {hasDiscount && (
                  <span className="absolute top-3 right-3 bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`bg-white rounded-lg p-2 border-2 transition-colors ${
                      selectedImage === index
                        ? 'border-brand-orange'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {!imgErrors[index] ? (
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full aspect-square object-contain"
                        onError={() => handleImageError(index)}
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-gray-300">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-3">
              {product.name}
            </h1>

            <div className="mb-4">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-brand-orange">
                  R{displayPrice.toFixed(2)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                  <span className="text-lg text-gray-500 line-through">
                    R{product.compareAtPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-brand-black mb-2">Description</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
            </div>

            <div className="bg-white rounded-xl p-4 mb-6">
              <h2 className="text-lg font-semibold text-brand-black mb-3">Product Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">SKU:</dt>
                  <dd className="font-semibold text-brand-black">{product.sku}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Category:</dt>
                  <dd className="font-semibold text-brand-black capitalize">{product.category}</dd>
                </div>
                {product.unit && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Unit:</dt>
                    <dd className="font-semibold text-brand-black">{product.unit}</dd>
                  </div>
                )}
                {product.weight && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Weight:</dt>
                    <dd className="font-semibold text-brand-black">{product.weight}kg</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-600">Stock:</dt>
                  <dd className={`font-semibold ${
                    product.stockLevel > 10 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {product.stockLevel > 0 ? `${product.stockLevel} available` : 'Out of stock'}
                  </dd>
                </div>
              </dl>
            </div>

            {product.stockLevel > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-700 font-medium text-sm">Quantity:</span>
                  <div className="flex items-center border-2 border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="px-4 text-lg font-semibold text-brand-black">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stockLevel, quantity + 1))}
                      className="p-2 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-orange hover:bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Add to Cart</span>
                </button>
              </div>
            ) : (
              <button
                disabled
                className="w-full py-3 bg-gray-300 text-gray-600 rounded-lg font-semibold cursor-not-allowed"
              >
                Out of Stock
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}