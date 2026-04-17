'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Edit, Trash2, Tag, Search, Save, X, Upload,
  Calendar, Loader2, RefreshCw, Zap, ChevronDown, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';
import { uploadToCloudinary } from '@/lib/cloudinary';

type SpecialType =
  | 'percentage_off'
  | 'amount_off'
  | 'buy_x_get_y'
  | 'multibuy'
  | 'bundle'
  | 'fixed_price'
  | 'conditional_add_on_price';

interface SpecialCondition {
  buyProductId?: string;
  buyQuantity?: number;
  getProductId?: string;
  getQuantity?: number;
  getDiscount?: number;
  requiredQuantity?: number;
  specialPrice?: number;
  bundleProducts?: { productId: string; variantId?: string; quantity: number }[];
  bundlePrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  newPrice?: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  limitPerCustomer?: number;
  triggerProductId?: string;
  triggerQuantity?: number;
  triggerPrice?: number;
  targetProductId?: string;
  targetQuantity?: number;
  overridePrice?: number;
}

interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: SpecialType;
  productId?: string;
  productIds?: string[];
  categoryId?: string;
  conditions: SpecialCondition;
  badgeText?: string;
  images?: string[];
  active: boolean;
  featured: boolean;
  startDate?: string;
  endDate?: string;
  stockLimit?: number;
  stockUsed?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Product {
  _id: string;
  name: string;
  price?: number;
  variants?: { _id: string; name: string }[];
}

interface Category {
  _id: string;
  name: string;
  slug: string;
}

const SPECIAL_TYPES = [
  { value: 'percentage_off', label: 'Percentage Off', icon: '%', desc: 'e.g. 20% off' },
  { value: 'amount_off', label: 'Amount Off', icon: 'R-', desc: 'e.g. R10 off' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y', icon: '🎁', desc: 'e.g. Buy 2 Get 1 Free' },
  { value: 'multibuy', label: 'Multibuy', icon: '×', desc: 'e.g. 2 for R50' },
  { value: 'bundle', label: 'Bundle Deal', icon: '📦', desc: 'Buy together & save' },
  { value: 'fixed_price', label: 'Fixed Price', icon: '=', desc: 'e.g. Now R79.99' },
  { value: 'conditional_add_on_price', label: 'Conditional Add-On', icon: '🔓', desc: 'Upsell unlock' },
];

export default function AdminSpecialsPage() {
  const { branch, loading: branchLoading } = useBranch();

  const [specials, setSpecials] = useState<Special[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<Special | null>(null);
  const [uploading, setUploading] = useState(false);

  // Product search within modal — replaces static list with real-time search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [productPage, setProductPage] = useState(1);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const PRODUCTS_PER_PAGE = 100;

  // Per-picker search terms
  const [buyProductSearch, setBuyProductSearch] = useState('');
  const [getProductSearch, setGetProductSearch] = useState('');
  const [triggerProductSearch, setTriggerProductSearch] = useState('');
  const [targetProductSearch, setTargetProductSearch] = useState('');
  const [bundleSearches, setBundleSearches] = useState<{ [k: number]: string }>({});

  // Specials search (server-side)
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSpecials, setFilteredSpecials] = useState<Special[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'percentage_off' as SpecialType,
    productId: '',
    productIds: [] as string[],
    categoryId: '',
    badgeText: '',
    image: '',
    active: true,
    featured: false,
    startDate: '',
    endDate: '',
    stockLimit: '',
    conditions: {
      discountPercentage: '',
      discountAmount: '',
      newPrice: '',
      requiredQuantity: '',
      specialPrice: '',
      buyProductId: '',
      buyQuantity: '',
      getProductId: '',
      getQuantity: '',
      getDiscount: '',
      bundleProducts: [] as { productId: string; variantId?: string; quantity: number }[],
      bundlePrice: '',
      minimumPurchase: '',
      maximumDiscount: '',
      limitPerCustomer: '',
      triggerProductId: '',
      triggerQuantity: '',
      triggerPrice: '',
      targetProductId: '',
      targetQuantity: '',
      overridePrice: '',
    },
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchSpecials();
      fetchProducts();
      fetchCategories();
    }
  }, [branchLoading, branch]);

  useEffect(() => {
    const q = searchTerm.toLowerCase();
    setFilteredSpecials(
      specials.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.type.replace(/_/g, ' ').includes(q)
      )
    );
  }, [searchTerm, specials]);

  const fetchProducts = async (page = 1) => {
    if (!branch) return;
    try {
      setLoadingMoreProducts(page > 1);
      const res = await fetch(`/api/products?all=true&page=${page}&limit=${PRODUCTS_PER_PAGE}`);
      if (res.ok) {
        const data = await res.json();
        const newProducts = data.products || [];
        if (page === 1) {
          setProducts(newProducts);
          setProductResults(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
          setProductResults(prev => [...prev, ...newProducts]);
        }
        setHasMoreProducts(newProducts.length === PRODUCTS_PER_PAGE);
        setProductPage(page);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  const searchProducts = async (query: string, setter: (p: Product[]) => void) => {
    if (!query.trim() || query.trim().length < 2) {
      setter(products.slice(0, 50));
      return;
    }
    setProductSearchLoading(true);
    try {
      const res = await fetch(`/api/products?all=true&search=${encodeURIComponent(query)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setter(data.products || []);
      }
    } catch (err) {
      console.error('Product search error:', err);
    } finally {
      setProductSearchLoading(false);
    }
  };

  const loadMoreProducts = () => {
    if (!loadingMoreProducts && hasMoreProducts) fetchProducts(productPage + 1);
  };

  const fetchSpecials = async () => {
    if (!branch) return;
    try {
      setLoading(true);
      const res = await fetch('/api/specials');
      if (res.ok) {
        const data = await res.json();
        setSpecials(data.specials || []);
      } else {
        toast.error('Failed to load specials');
      }
    } catch {
      toast.error('Failed to load specials');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) { toast.error('Only JPG, PNG, WebP allowed'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, image: url }));
      toast.success('Image uploaded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', type: 'percentage_off', productId: '',
      productIds: [], categoryId: '', badgeText: '', image: '', active: true,
      featured: false, startDate: '', endDate: '', stockLimit: '',
      conditions: {
        discountPercentage: '', discountAmount: '', newPrice: '', requiredQuantity: '',
        specialPrice: '', buyProductId: '', buyQuantity: '', getProductId: '',
        getQuantity: '', getDiscount: '', bundleProducts: [], bundlePrice: '',
        minimumPurchase: '', maximumDiscount: '', limitPerCustomer: '',
        triggerProductId: '', triggerQuantity: '', triggerPrice: '',
        targetProductId: '', targetQuantity: '', overridePrice: '',
      },
    });
    setBuyProductSearch('');
    setGetProductSearch('');
    setTriggerProductSearch('');
    setTargetProductSearch('');
    setBundleSearches({});
  };

  const handleEdit = (special: Special) => {
    setEditingSpecial(special);
    setFormData({
      name: special.name, description: special.description, type: special.type,
      productId: special.productId || '', productIds: special.productIds || [],
      categoryId: special.categoryId || '', badgeText: special.badgeText || '',
      image: (special.images && special.images.length > 0) ? special.images[0] : '',
      active: special.active, featured: special.featured,
      startDate: special.startDate || '', endDate: special.endDate || '',
      stockLimit: special.stockLimit?.toString() || '',
      conditions: {
        discountPercentage: special.conditions.discountPercentage?.toString() || '',
        discountAmount: special.conditions.discountAmount?.toString() || '',
        newPrice: special.conditions.newPrice?.toString() || '',
        requiredQuantity: special.conditions.requiredQuantity?.toString() || '',
        specialPrice: special.conditions.specialPrice?.toString() || '',
        buyProductId: special.conditions.buyProductId || '',
        buyQuantity: special.conditions.buyQuantity?.toString() || '',
        getProductId: special.conditions.getProductId || '',
        getQuantity: special.conditions.getQuantity?.toString() || '',
        getDiscount: special.conditions.getDiscount?.toString() || '',
        bundleProducts: special.conditions.bundleProducts || [],
        bundlePrice: special.conditions.bundlePrice?.toString() || '',
        minimumPurchase: special.conditions.minimumPurchase?.toString() || '',
        maximumDiscount: special.conditions.maximumDiscount?.toString() || '',
        limitPerCustomer: special.conditions.limitPerCustomer?.toString() || '',
        triggerProductId: special.conditions.triggerProductId || '',
        triggerQuantity: special.conditions.triggerQuantity?.toString() || '',
        triggerPrice: special.conditions.triggerPrice?.toString() || '',
        targetProductId: special.conditions.targetProductId || '',
        targetQuantity: special.conditions.targetQuantity?.toString() || '',
        overridePrice: special.conditions.overridePrice?.toString() || '',
      },
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this special?')) return;
    try {
      const res = await fetch(`/api/specials/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Special deleted'); fetchSpecials(); }
      else toast.error('Failed to delete special');
    } catch { toast.error('An error occurred'); }
  };

  const addBundleProduct = () => {
    setFormData(prev => ({
      ...prev,
      conditions: { ...prev.conditions, bundleProducts: [...prev.conditions.bundleProducts, { productId: '', quantity: 1 }] },
    }));
  };

  const removeBundleProduct = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: { ...prev.conditions, bundleProducts: prev.conditions.bundleProducts.filter((_, i) => i !== index) },
    }));
  };

  const updateBundleProduct = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        bundleProducts: prev.conditions.bundleProducts.map((bp, i) => i === index ? { ...bp, [field]: value } : bp),
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const conditions: any = {};
      switch (formData.type) {
        case 'percentage_off':
          if (!formData.conditions.discountPercentage) { toast.error('Enter discount percentage'); setSaving(false); return; }
          conditions.discountPercentage = parseFloat(formData.conditions.discountPercentage);
          if (formData.conditions.maximumDiscount) conditions.maximumDiscount = parseFloat(formData.conditions.maximumDiscount);
          break;
        case 'amount_off':
          if (!formData.conditions.discountAmount) { toast.error('Enter discount amount'); setSaving(false); return; }
          conditions.discountAmount = parseFloat(formData.conditions.discountAmount);
          break;
        case 'fixed_price':
          if (!formData.conditions.newPrice) { toast.error('Enter new price'); setSaving(false); return; }
          conditions.newPrice = parseFloat(formData.conditions.newPrice);
          break;
        case 'multibuy':
          if (!formData.conditions.requiredQuantity || !formData.conditions.specialPrice) { toast.error('Enter required quantity and special price'); setSaving(false); return; }
          conditions.requiredQuantity = parseInt(formData.conditions.requiredQuantity);
          conditions.specialPrice = parseFloat(formData.conditions.specialPrice);
          break;
        case 'buy_x_get_y':
          if (!formData.conditions.buyProductId || !formData.conditions.buyQuantity || !formData.conditions.getProductId || !formData.conditions.getQuantity) {
            toast.error('Fill in all Buy X Get Y fields'); setSaving(false); return;
          }
          conditions.buyProductId = formData.conditions.buyProductId;
          conditions.buyQuantity = parseInt(formData.conditions.buyQuantity);
          conditions.getProductId = formData.conditions.getProductId;
          conditions.getQuantity = parseInt(formData.conditions.getQuantity);
          conditions.getDiscount = formData.conditions.getDiscount ? parseFloat(formData.conditions.getDiscount) : 100;
          break;
        case 'bundle':
          if (formData.conditions.bundleProducts.length === 0 || !formData.conditions.bundlePrice) {
            toast.error('Add bundle products and set bundle price'); setSaving(false); return;
          }
          conditions.bundleProducts = formData.conditions.bundleProducts;
          conditions.bundlePrice = parseFloat(formData.conditions.bundlePrice);
          break;
        case 'conditional_add_on_price':
          if (!formData.conditions.triggerProductId || !formData.conditions.triggerQuantity || !formData.conditions.triggerPrice || !formData.conditions.targetProductId || !formData.conditions.targetQuantity || !formData.conditions.overridePrice) {
            toast.error('Fill in all Conditional Add-On fields'); setSaving(false); return;
          }
          conditions.triggerProductId = formData.conditions.triggerProductId;
          conditions.triggerQuantity = parseInt(formData.conditions.triggerQuantity);
          conditions.triggerPrice = parseFloat(formData.conditions.triggerPrice);
          conditions.targetProductId = formData.conditions.targetProductId;
          conditions.targetQuantity = parseInt(formData.conditions.targetQuantity);
          conditions.overridePrice = parseFloat(formData.conditions.overridePrice);
          break;
      }
      if (formData.conditions.minimumPurchase) conditions.minimumPurchase = parseFloat(formData.conditions.minimumPurchase);
      if (formData.conditions.limitPerCustomer) conditions.limitPerCustomer = parseInt(formData.conditions.limitPerCustomer);

      const specialData = {
        name: formData.name,
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: formData.description,
        type: formData.type,
        productId: formData.productId || undefined,
        productIds: formData.productIds.length > 0 ? formData.productIds : undefined,
        categoryId: formData.categoryId || undefined,
        conditions,
        badgeText: formData.badgeText || undefined,
        images: formData.image ? [formData.image] : undefined,
        active: formData.active,
        featured: formData.featured,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        stockLimit: formData.stockLimit ? parseInt(formData.stockLimit) : undefined,
      };

      const url = editingSpecial ? `/api/specials/${editingSpecial._id}` : '/api/specials';
      const method = editingSpecial ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(specialData) });
      if (res.ok) {
        toast.success(editingSpecial ? 'Special updated!' : 'Special created!');
        setShowModal(false); setEditingSpecial(null); resetForm(); fetchSpecials();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save special');
      }
    } catch { toast.error('An error occurred'); }
    finally { setSaving(false); }
  };

  const getSpecialBadge = (special: Special) => {
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off': return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off': return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price': return `NOW R${special.conditions.newPrice}`;
      case 'multibuy': return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y': return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'conditional_add_on_price': return `UNLOCK @ R${special.conditions.overridePrice}`;
      default: return 'SPECIAL';
    }
  };

  const isSpecialActive = (special: Special) => {
    if (!special.active) return false;
    const now = new Date();
    if (special.startDate && new Date(special.startDate) > now) return false;
    if (special.endDate && new Date(special.endDate) < now) return false;
    return true;
  };

  // Filtered product lists for each picker
  const filterProducts = (query: string) => {
    if (!query || query.length < 2) return products.slice(0, 30);
    return products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  };

  // Reusable product picker component
  const ProductPicker = ({
    label, value, onChange, searchVal, onSearchChange, required = false
  }: {
    label: string; value: string; onChange: (v: string) => void;
    searchVal: string; onSearchChange: (v: string) => void; required?: boolean;
  }) => {
    const filtered = filterProducts(searchVal);
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
        <div className="relative mb-1.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={searchVal}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Filter products…"
          />
        </div>
        <select
          required={required}
          className="w-full border border-gray-200 rounded-xl text-xs p-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          size={6}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Select product…</option>
          {filtered.map(p => (
            <option key={p._id} value={p._id}>
              {p.name}{p.price != null ? ` — R${p.price.toFixed(2)}` : ''}
            </option>
          ))}
        </select>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{filtered.length} shown</span>
          {hasMoreProducts && (
            <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-orange-500 hover:text-orange-700 font-medium">
              {loadingMoreProducts ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">Could not find the requested branch.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Specials & Promotions</h1>
            <p className="text-gray-500 mt-1">
              {branch.displayName} &mdash; <span className="font-semibold text-orange-500">{specials.length} total</span>
            </p>
          </div>
          <button
            onClick={() => { setEditingSpecial(null); resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create Special
          </button>
        </div>

        {/* ── Search ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search specials by name, type, description…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-gray-500 mt-2 pl-1">
              <span className="font-semibold text-orange-500">{filteredSpecials.length}</span> of {specials.length} specials
            </p>
          )}
        </div>

        {/* ── Specials Grid ── */}
        {filteredSpecials.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-200">
            <Tag className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? `No results for "${searchTerm}"` : 'No specials yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {searchTerm ? 'Try different keywords' : 'Create your first special offer'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Create Special
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Special</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Badge</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Dates</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSpecials.map(special => (
                    <tr key={special._id} className="hover:bg-orange-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {special.images?.[0] ? (
                            <img src={special.images[0]} alt={special.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Zap className="w-5 h-5 text-orange-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{special.name}</p>
                            <p className="text-xs text-gray-400 line-clamp-1">{special.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium capitalize">
                          {special.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                          {getSpecialBadge(special)}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {special.startDate && <p>From: {new Date(special.startDate).toLocaleDateString()}</p>}
                          {special.endDate && <p>To: {new Date(special.endDate).toLocaleDateString()}</p>}
                          {!special.startDate && !special.endDate && <span className="text-gray-300">No dates</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${isSpecialActive(special) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {isSpecialActive(special) ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(special)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(special._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════
              SPECIALS MODAL
         ══════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSpecial ? 'Edit Special' : 'Create New Special'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingSpecial(null); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[calc(100vh-160px)] overflow-y-auto">

              {/* Basic Info */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Special Name *</label>
                    <input type="text" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Summer Sale" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                    <textarea required rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>

                  {/* Special Type - Card Grid */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Special Type *</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {SPECIAL_TYPES.map(type => (
                        <label key={type.value} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${formData.type === type.value ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200'}`}>
                          <input type="radio" name="type" value={type.value} className="sr-only" checked={formData.type === type.value} onChange={() => setFormData({ ...formData, type: type.value as SpecialType })} />
                          <span className="text-lg">{type.icon}</span>
                          <span className="text-xs font-semibold text-gray-800">{type.label}</span>
                          <span className="text-xs text-gray-400">{type.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Badge Text <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.badgeText} onChange={e => setFormData({ ...formData, badgeText: e.target.value })} placeholder="e.g. SUPER SALE" />
                    </div>
                  </div>

                  {/* Image Upload */}
                  {formData.image ? (
                    <div className="relative inline-block">
                      <img src={formData.image} alt="Special" className="w-full max-w-xs h-32 object-cover rounded-xl border border-gray-200" />
                      <button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-300 transition-colors">
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                        <span className="text-xs text-gray-400">{uploading ? 'Uploading…' : 'Upload special image (optional)'}</span>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              </section>

              {/* Conditions */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Conditions</h3>

                {formData.type === 'percentage_off' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount % (0-100) *</label>
                      <input type="number" step="0.01" min="0" max="100" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.discountPercentage} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, discountPercentage: e.target.value } })} placeholder="20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Discount (R) <span className="text-gray-400 font-normal">optional</span></label>
                      <input type="number" step="0.01" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.maximumDiscount} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, maximumDiscount: e.target.value } })} placeholder="100" />
                    </div>
                  </div>
                )}

                {formData.type === 'amount_off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount Amount (R) *</label>
                    <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.discountAmount} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, discountAmount: e.target.value } })} placeholder="10.00" />
                  </div>
                )}

                {formData.type === 'fixed_price' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fixed Price (R) *</label>
                    <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.newPrice} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, newPrice: e.target.value } })} placeholder="79.99" />
                  </div>
                )}

                {formData.type === 'multibuy' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Qty *</label>
                      <input type="number" min="1" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.requiredQuantity} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, requiredQuantity: e.target.value } })} placeholder="2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Special Price (R) *</label>
                      <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.specialPrice} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, specialPrice: e.target.value } })} placeholder="50.00" />
                    </div>
                  </div>
                )}

                {formData.type === 'buy_x_get_y' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium">
                      Example: Buy 1 Peanut Butter → Get 1 Bread Free
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <ProductPicker label="Buy Product *" value={formData.conditions.buyProductId} onChange={v => setFormData({ ...formData, conditions: { ...formData.conditions, buyProductId: v } })} searchVal={buyProductSearch} onSearchChange={setBuyProductSearch} required />
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Buy Quantity *</label>
                        <input type="number" min="1" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.buyQuantity} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, buyQuantity: e.target.value } })} placeholder="1" />
                      </div>
                      <ProductPicker label="Get Product *" value={formData.conditions.getProductId} onChange={v => setFormData({ ...formData, conditions: { ...formData.conditions, getProductId: v } })} searchVal={getProductSearch} onSearchChange={setGetProductSearch} required />
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Get Quantity *</label>
                          <input type="number" min="1" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.getQuantity} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, getQuantity: e.target.value } })} placeholder="1" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount % (100 = Free)</label>
                          <input type="number" min="0" max="100" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.getDiscount} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, getDiscount: e.target.value } })} placeholder="100" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formData.type === 'bundle' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Bundle Products *</label>
                      <button type="button" onClick={addBundleProduct} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl border border-orange-200 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Product
                      </button>
                    </div>
                    {formData.conditions.bundleProducts.map((bp, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">Product {index + 1}</span>
                          <button type="button" onClick={() => removeBundleProduct(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <ProductPicker label="Product *" value={bp.productId} onChange={v => updateBundleProduct(index, 'productId', v)} searchVal={bundleSearches[index] || ''} onSearchChange={v => setBundleSearches(prev => ({ ...prev, [index]: v }))} required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Qty *</label>
                            <input type="number" min="1" required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={bp.quantity} onChange={e => updateBundleProduct(index, 'quantity', parseInt(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Bundle Price (R) *</label>
                      <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.bundlePrice} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, bundlePrice: e.target.value } })} placeholder="150.00" />
                    </div>
                  </div>
                )}

                {formData.type === 'conditional_add_on_price' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                      Example: Buy Corn Flakes → unlock Milk (6×1L) for R69.99
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <ProductPicker label="Trigger Product *" value={formData.conditions.triggerProductId} onChange={v => setFormData({ ...formData, conditions: { ...formData.conditions, triggerProductId: v } })} searchVal={triggerProductSearch} onSearchChange={setTriggerProductSearch} required />
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trigger Qty *</label>
                        <input type="number" min="1" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.triggerQuantity} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, triggerQuantity: e.target.value } })} placeholder="1" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trigger Price (R) *</label>
                        <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.triggerPrice} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, triggerPrice: e.target.value } })} placeholder="59.99" />
                      </div>
                      <div className="md:col-span-2">
                        <ProductPicker label="Add-On Product *" value={formData.conditions.targetProductId} onChange={v => setFormData({ ...formData, conditions: { ...formData.conditions, targetProductId: v } })} searchVal={targetProductSearch} onSearchChange={setTargetProductSearch} required />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Add-On Qty *</label>
                          <input type="number" min="1" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.targetQuantity} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, targetQuantity: e.target.value } })} placeholder="1" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Override Price (R) *</label>
                          <input type="number" step="0.01" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.overridePrice} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, overridePrice: e.target.value } })} placeholder="69.99" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Apply To */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Apply Special To</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Single Product</label>
                    <ProductPicker label="" value={formData.productId} onChange={v => setFormData({ ...formData, productId: v })} searchVal={productSearch} onSearchChange={setProductSearch} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                    <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                      <option value="">Select category (optional)</option>
                      {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Validity & Settings */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Validity & Settings</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <input type="datetime-local" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                    <input type="datetime-local" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Limit</label>
                    <input type="number" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.stockLimit} onChange={e => setFormData({ ...formData, stockLimit: e.target.value })} placeholder="Leave empty for unlimited" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Limit Per Customer</label>
                    <input type="number" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.conditions.limitPerCustomer} onChange={e => setFormData({ ...formData, conditions: { ...formData.conditions, limitPerCustomer: e.target.value } })} placeholder="e.g. 5" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { key: 'active', label: 'Active', desc: 'Special is live and applicable' },
                    { key: 'featured', label: 'Featured', desc: 'Show in featured specials section' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer p-3.5 border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                      <input type="checkbox" checked={(formData as any)[key]} onChange={e => setFormData({ ...formData, [key]: e.target.checked })} className="w-4 h-4 mt-0.5 accent-orange-500 rounded" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Actions */}
              <div className="sticky bottom-0 bg-white border-t pt-4 pb-1 flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowModal(false); setEditingSpecial(null); resetForm(); }} className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : editingSpecial ? 'Update Special' : 'Create Special'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}