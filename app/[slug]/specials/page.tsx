'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { Package, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ComboCard from '@/components/ComboCard';
import SpecialCard from '@/components/SpecialCard';

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  categories?: string[];
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  onSpecial?: boolean;
  active: boolean;
  hasVariants?: boolean;
  variants?: any[];
  specialId?: string;
}

interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  badgeText?: string;
  images?: string[];
  conditions: any;
  active: boolean;
  featured: boolean;
  startDate?: string;
  endDate?: string;
  productId?: string;
  productIds?: string[];
  categoryId?: string;
}

interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
  comboPrice: number;
  regularPrice: number;
  images: string[];
  active: boolean;
  featured: boolean;
  stockLevel: number;
}

export default function SpecialsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [promotionalSpecials, setPromotionalSpecials] = useState<Special[]>([]);
  const [productSpecials, setProductSpecials] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchAllSpecials();
    }
  }, [branchLoading, branch]);

  const fetchAllSpecials = async () => {
    if (!branch) return;
    
    try {
      console.log('🔍 Fetching all specials for branch:', branch.displayName, 'ID:', branch.id);
      
      // ✅ FIX: Fetch promotional specials WITH branchId
      const specialsRes = await fetch(`/api/specials?active=true&branchId=${branch.id}`);
      if (specialsRes.ok) {
        const data = await specialsRes.json();
        console.log('✅ Promotional specials:', data.specials?.length || 0);
        setPromotionalSpecials(data.specials || []);
      }

      // ✅ FIX: Fetch product specials WITH branchId
      const productsRes = await fetch(`/api/products?special=true&branchId=${branch.id}`);
      if (productsRes.ok) {
        const data = await productsRes.json();
        const active = (data.products || []).filter(
          (p: Product) => p.active && p.stockLevel > 0
        );
        console.log('✅ Product specials:', active.length);
        setProductSpecials(active);
      }

      // ✅ FIX: Fetch combos WITH branchId
      const combosRes = await fetch(`/api/combos?active=true&branchId=${branch.id}`);
      if (combosRes.ok) {
        const data = await combosRes.json();
        const active = (data.combos || []).filter(
          (c: Combo) => c.active && c.stockLevel > 0
        );
        console.log('✅ Combos:', active.length);
        setCombos(active);
      }
    } catch (error) {
      console.error('❌ Error loading specials:', error);
    } finally {
      setLoading(false);
    }
  };

  const featuredPromotions = promotionalSpecials.filter(s => s.featured);
  const regularPromotions = promotionalSpecials.filter(s => !s.featured);
  const featuredCombos = combos.filter(c => c.featured);
  const regularCombos = combos.filter(c => !c.featured);
  const hasContent = promotionalSpecials.length > 0 || productSpecials.length > 0 || combos.length > 0;

  if (branchLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <Loader2 className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading specials...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">The requested branch could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
            Special Offers
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Check out our latest deals and promotions at {branch.displayName}. Limited time offers!
          </p>
        </div>

        {!hasContent ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Active Specials
            </h3>
            <p className="text-gray-600 mb-6">
              Check back soon for new deals and promotions!
            </p>
            <Link href={`/${slug}/shop`} className="btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Featured Promotional Specials */}
            {featuredPromotions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Featured Deals
                  </h2>
                  <span className="text-sm text-gray-600 bg-red-100 px-3 py-1 rounded-full">
                    {featuredPromotions.length} featured
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {featuredPromotions.map((special) => (
                    <SpecialCard key={special._id} special={special} />
                  ))}
                </div>
              </div>
            )}

            {/* Featured Combo Deals */}
            {featuredCombos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Featured Combo Deals
                  </h2>
                  <span className="text-sm text-gray-600 bg-purple-100 px-3 py-1 rounded-full">
                    {featuredCombos.length} featured
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {featuredCombos.map((combo) => (
                    <ComboCard key={combo._id} combo={combo} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Promotional Specials */}
            {regularPromotions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Promotional Deals
                  </h2>
                  <span className="text-sm text-gray-600 bg-orange-100 px-3 py-1 rounded-full">
                    {regularPromotions.length} deals
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {regularPromotions.map((special) => (
                    <SpecialCard key={special._id} special={special} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Combo Deals */}
            {regularCombos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Combo Deals
                  </h2>
                  <span className="text-sm text-gray-600 bg-purple-100 px-3 py-1 rounded-full">
                    {regularCombos.length} {regularCombos.length === 1 ? 'combo' : 'combos'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {regularCombos.map((combo) => (
                    <ComboCard key={combo._id} combo={combo} />
                  ))}
                </div>
              </div>
            )}

            {/* Product Specials */}
            {productSpecials.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Product Specials
                  </h2>
                  <span className="text-sm text-gray-600 bg-green-100 px-3 py-1 rounded-full">
                    {productSpecials.length} {productSpecials.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {productSpecials.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}