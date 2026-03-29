'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit, Trash2, Tag, Search, Save, X, Calendar, Package, Upload } from 'lucide-react';
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
  buyProductVariantId?: string;
  buyQuantity?: number;
  getProductId?: string;
  getProductVariantId?: string;
  getQuantity?: number;
  getDiscount?: number;
  requiredQuantity?: number;
  specialPrice?: number;
  bundleProducts?: {
    productId: string;
    variantId?: string;
    quantity: number;
  }[];
  bundlePrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  newPrice?: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  limitPerCustomer?: number;
  applyToAll?: boolean;
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
  variants?: { _id: string; name: string; }[];
}

interface Category {
  _id: string;
  name: string;
  slug: string;
}

const SPECIAL_TYPES = [
  { value: 'percentage_off', label: 'Percentage Off (e.g., 20% off)' },
  { value: 'amount_off', label: 'Amount Off (e.g., R10 off)' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y (e.g., Buy 2 Get 1 Free)' },
  { value: 'multibuy', label: 'Multibuy (e.g., 2 for R50)' },
  { value: 'bundle', label: 'Bundle Deal (e.g., Buy together save)' },
  { value: 'fixed_price', label: 'Fixed Price (e.g., Now R79.99)' },
  { value: 'conditional_add_on_price', label: 'Conditional Add-On Price (Upsell Unlock)' },
];

export default function AdminSpecialsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [specials, setSpecials] = useState<Special[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<Special | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Filter terms for the dropdowns
  const [productFilterTerm, setProductFilterTerm] = useState('');
  const [buyProductFilterTerm, setBuyProductFilterTerm] = useState('');
  const [getProductFilterTerm, setGetProductFilterTerm] = useState('');
  const [bundleFilterTerms, setBundleFilterTerms] = useState<{[key: number]: string}>({});
  const [triggerProductFilterTerm, setTriggerProductFilterTerm] = useState('');
  const [targetProductFilterTerm, setTargetProductFilterTerm] = useState('');
  
  // Pagination for products
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const PRODUCTS_PER_PAGE = 100;

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
      bundleProducts: [] as { productId: string; variantId?: string; quantity: number; }[],
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
    }
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchSpecials();
      fetchProducts();
      fetchCategories();
    }
  }, [branchLoading, branch]);

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
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
        
        setHasMoreProducts(newProducts.length === PRODUCTS_PER_PAGE);
        setProductPage(page);
        console.log(`✅ Loaded page ${page}: ${newProducts.length} products (${data.total} total)`);
      } else {
        console.error('Failed to load products:', res.status);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  };
  
  const loadMoreProducts = () => {
    if (!loadingMoreProducts && hasMoreProducts) {
      fetchProducts(productPage + 1);
    }
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
    } catch (error) {
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
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image must be under 10MB');
      return;
    }

    setUploading(true);
    
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, image: url }));
      toast.success('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'percentage_off',
      productId: '',
      productIds: [],
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
        bundleProducts: [],
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
      }
    });
    setProductFilterTerm('');
    setBuyProductFilterTerm('');
    setGetProductFilterTerm('');
    setBundleFilterTerms({});
    setTriggerProductFilterTerm('');
    setTargetProductFilterTerm('');
  };

  const handleEdit = (special: Special) => {
    setEditingSpecial(special);
    
    setFormData({
      name: special.name,
      description: special.description,
      type: special.type,
      productId: special.productId || '',
      productIds: special.productIds || [],
      categoryId: special.categoryId || '',
      badgeText: special.badgeText || '',
      image: (special.images && special.images.length > 0) ? special.images[0] : '',
      active: special.active,
      featured: special.featured,
      startDate: special.startDate || '',
      endDate: special.endDate || '',
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
      }
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this special?')) return;

    try {
      const res = await fetch(`/api/specials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Special deleted');
        fetchSpecials();
      } else {
        toast.error('Failed to delete special');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const addBundleProduct = () => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        bundleProducts: [
          ...prev.conditions.bundleProducts,
          { productId: '', productName: '', quantity: 1 }
        ]
      }
    }));
  };

  const removeBundleProduct = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        bundleProducts: prev.conditions.bundleProducts.filter((_, i) => i !== index)
      }
    }));
  };

  const updateBundleProduct = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        bundleProducts: prev.conditions.bundleProducts.map((bp, i) =>
          i === index ? { ...bp, [field]: value } : bp
        )
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const conditions: any = {};

      switch (formData.type) {
        case 'percentage_off':
          if (!formData.conditions.discountPercentage) {
            toast.error('Please enter discount percentage');
            setSaving(false);
            return;
          }
          conditions.discountPercentage = parseFloat(formData.conditions.discountPercentage);
          if (formData.conditions.maximumDiscount) {
            conditions.maximumDiscount = parseFloat(formData.conditions.maximumDiscount);
          }
          break;

        case 'amount_off':
          if (!formData.conditions.discountAmount) {
            toast.error('Please enter discount amount');
            setSaving(false);
            return;
          }
          conditions.discountAmount = parseFloat(formData.conditions.discountAmount);
          break;

        case 'fixed_price':
          if (!formData.conditions.newPrice) {
            toast.error('Please enter new price');
            setSaving(false);
            return;
          }
          conditions.newPrice = parseFloat(formData.conditions.newPrice);
          break;

        case 'multibuy':
          if (!formData.conditions.requiredQuantity || !formData.conditions.specialPrice) {
            toast.error('Please enter required quantity and special price');
            setSaving(false);
            return;
          }
          conditions.requiredQuantity = parseInt(formData.conditions.requiredQuantity);
          conditions.specialPrice = parseFloat(formData.conditions.specialPrice);
          break;

        case 'buy_x_get_y':
          if (!formData.conditions.buyProductId || !formData.conditions.buyQuantity || 
              !formData.conditions.getProductId || !formData.conditions.getQuantity) {
            toast.error('Please fill in all Buy X Get Y fields');
            setSaving(false);
            return;
          }
          conditions.buyProductId = formData.conditions.buyProductId;
          conditions.buyQuantity = parseInt(formData.conditions.buyQuantity);
          conditions.getProductId = formData.conditions.getProductId;
          conditions.getQuantity = parseInt(formData.conditions.getQuantity);
          conditions.getDiscount = formData.conditions.getDiscount ? parseFloat(formData.conditions.getDiscount) : 100;
          break;

        case 'bundle':
          if (formData.conditions.bundleProducts.length === 0 || !formData.conditions.bundlePrice) {
            toast.error('Please add bundle products and set bundle price');
            setSaving(false);
            return;
          }
          conditions.bundleProducts = formData.conditions.bundleProducts;
          conditions.bundlePrice = parseFloat(formData.conditions.bundlePrice);
          break;

        case 'conditional_add_on_price':
          if (
            !formData.conditions.triggerProductId ||
            !formData.conditions.triggerQuantity ||
            !formData.conditions.triggerPrice ||
            !formData.conditions.targetProductId ||
            !formData.conditions.targetQuantity ||
            !formData.conditions.overridePrice
          ) {
            toast.error('Please fill in all Conditional Add-On Price fields');
            setSaving(false);
            return;
          }
          conditions.triggerProductId = formData.conditions.triggerProductId;
          conditions.triggerQuantity = parseInt(formData.conditions.triggerQuantity);
          conditions.triggerPrice = parseFloat(formData.conditions.triggerPrice);
          conditions.targetProductId = formData.conditions.targetProductId;
          conditions.targetQuantity = parseInt(formData.conditions.targetQuantity);
          conditions.overridePrice = parseFloat(formData.conditions.overridePrice);
          break;
      }

      if (formData.conditions.minimumPurchase) {
        conditions.minimumPurchase = parseFloat(formData.conditions.minimumPurchase);
      }
      if (formData.conditions.limitPerCustomer) {
        conditions.limitPerCustomer = parseInt(formData.conditions.limitPerCustomer);
      }

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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialData),
      });

      if (res.ok) {
        toast.success(editingSpecial ? 'Special updated!' : 'Special created!');
        setShowModal(false);
        setEditingSpecial(null);
        resetForm();
        fetchSpecials();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save special');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredSpecials = specials.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
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
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Specials & Promotions</h1>
            <p className="text-gray-600">Manage specials for {branch.displayName}</p>
            <p className="text-sm text-gray-500 mt-1">{specials.length} total specials</p>
          </div>
          <button
            onClick={() => {
              setEditingSpecial(null);
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Special</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search specials..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Specials Table */}
        {filteredSpecials.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No specials found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Create your first special offer'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                Create Special
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Special</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Badge</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Dates</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSpecials.map((special) => (
                    <tr key={special._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{special.name}</p>
                          <p className="text-sm text-gray-600 line-clamp-1">{special.description}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 capitalize">
                          {special.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 bg-brand-orange text-white text-xs font-bold rounded-full">
                          {getSpecialBadge(special)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {special.startDate && <div>Start: {new Date(special.startDate).toLocaleDateString()}</div>}
                        {special.endDate && <div>End: {new Date(special.endDate).toLocaleDateString()}</div>}
                        {!special.startDate && !special.endDate && <span className="text-gray-400">No dates set</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${isSpecialActive(special) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {isSpecialActive(special) ? 'Active' : 'Inactive'}
                          </span>
                          {special.featured && (
                            <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-blue-100 text-blue-800">Featured</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleEdit(special)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDelete(special._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-5 h-5" />
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

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full my-8">
              <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-brand-black">
                    {editingSpecial ? 'Edit Special' : 'Create New Special'}
                  </h2>
                  <button onClick={() => { setShowModal(false); setEditingSpecial(null); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Basic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Special Name *</label>
                      <input type="text" required className="input-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Summer Sale, Buy 2 Get 1 Free" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                      <textarea required rows={3} className="input-field" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the special offer..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Special Type *</label>
                      <select required className="input-field" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as SpecialType })}>
                        {SPECIAL_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Badge Text (optional)</label>
                      <input type="text" className="input-field" value={formData.badgeText} onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })} placeholder="e.g., SUPER SALE, HOT DEAL" />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for auto-generated badge</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Special Image (optional)</label>
                      <p className="text-xs text-gray-600 mb-3">Upload an image that represents this special offer</p>
                      {formData.image ? (
                        <div className="relative inline-block">
                          <img src={formData.image} alt="Special" className="w-full max-w-md h-48 object-cover rounded-xl border-2 border-gray-200" />
                          <button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload image'}</span>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Special Conditions based on Type */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Special Conditions</h3>
                  
                  {formData.type === 'percentage_off' && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Discount Percentage * (0-100)</label>
                        <input type="number" step="0.01" min="0" max="100" required className="input-field" value={formData.conditions.discountPercentage} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, discountPercentage: e.target.value } })} placeholder="20" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Discount Amount (R)</label>
                        <input type="number" step="0.01" className="input-field" value={formData.conditions.maximumDiscount} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, maximumDiscount: e.target.value } })} placeholder="100" />
                      </div>
                    </div>
                  )}

                  {formData.type === 'amount_off' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount Amount (R) *</label>
                      <input type="number" step="0.01" required className="input-field" value={formData.conditions.discountAmount} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, discountAmount: e.target.value } })} placeholder="10.00" />
                    </div>
                  )}

                  {formData.type === 'fixed_price' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Fixed Price (R) *</label>
                      <input type="number" step="0.01" required className="input-field" value={formData.conditions.newPrice} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, newPrice: e.target.value } })} placeholder="79.99" />
                    </div>
                  )}

                  {formData.type === 'multibuy' && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Required Quantity *</label>
                        <input type="number" min="1" required className="input-field" value={formData.conditions.requiredQuantity} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, requiredQuantity: e.target.value } })} placeholder="2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Special Price (R) *</label>
                        <input type="number" step="0.01" required className="input-field" value={formData.conditions.specialPrice} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, specialPrice: e.target.value } })} placeholder="50.00" />
                      </div>
                    </div>
                  )}

                  {formData.type === 'buy_x_get_y' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-900 font-semibold mb-2">Buy X Get Y Setup</p>
                        <p className="text-xs text-blue-700">Example: Buy 1 Peanut Butter, Get 1 Bread Free</p>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Buy Product */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Buy Product *</label>
                          <input type="text" className="input-field mb-2" value={buyProductFilterTerm} onChange={(e) => setBuyProductFilterTerm(e.target.value)} placeholder="Filter products..." />
                          <select
                            required
                            className="input-field h-40 overflow-y-auto"
                            size={8}
                            value={formData.conditions.buyProductId}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, buyProductId: e.target.value } })}
                          >
                            <option value="">Select product to buy</option>
                            {products
                              .filter(p => p.name.toLowerCase().includes(buyProductFilterTerm.toLowerCase()))
                              .map((p) => (
                                <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                              ))}
                          </select>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{products.filter(p => p.name.toLowerCase().includes(buyProductFilterTerm.toLowerCase())).length} products shown</span>
                            {hasMoreProducts && (
                              <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                                {loadingMoreProducts ? 'Loading...' : 'Load More'}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Buy Quantity *</label>
                          <input type="number" min="1" required className="input-field" value={formData.conditions.buyQuantity} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, buyQuantity: e.target.value } })} placeholder="1" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Get Product */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Get Product *</label>
                          <input type="text" className="input-field mb-2" value={getProductFilterTerm} onChange={(e) => setGetProductFilterTerm(e.target.value)} placeholder="Filter products..." />
                          <select
                            required
                            className="input-field h-40 overflow-y-auto"
                            size={8}
                            value={formData.conditions.getProductId}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, getProductId: e.target.value } })}
                          >
                            <option value="">Select product to get</option>
                            {products
                              .filter(p => p.name.toLowerCase().includes(getProductFilterTerm.toLowerCase()))
                              .map((p) => (
                                <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                              ))}
                          </select>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{products.filter(p => p.name.toLowerCase().includes(getProductFilterTerm.toLowerCase())).length} products shown</span>
                            {hasMoreProducts && (
                              <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                                {loadingMoreProducts ? 'Loading...' : 'Load More'}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Get Quantity *</label>
                            <input type="number" min="1" required className="input-field" value={formData.conditions.getQuantity} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, getQuantity: e.target.value } })} placeholder="1" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Discount % (100 = Free)</label>
                            <input type="number" min="0" max="100" className="input-field" value={formData.conditions.getDiscount} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, getDiscount: e.target.value } })} placeholder="100" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.type === 'bundle' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Bundle Products *</label>
                        <button type="button" onClick={addBundleProduct} className="btn-secondary text-sm flex items-center space-x-1">
                          <Plus className="w-4 h-4" />
                          <span>Add Product</span>
                        </button>
                      </div>

                      {formData.conditions.bundleProducts.map((bp, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Product {index + 1}</span>
                            <button type="button" onClick={() => removeBundleProduct(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input type="text" className="input-field" value={bundleFilterTerms[index] || ''} onChange={(e) => setBundleFilterTerms(prev => ({ ...prev, [index]: e.target.value }))} placeholder="Filter products..." />
                            <div className="flex items-center space-x-2">
                              <select
                                required
                                className="input-field flex-1 h-32 overflow-y-auto"
                                size={6}
                                value={bp.productId}
                                onChange={(e) => updateBundleProduct(index, 'productId', e.target.value)}
                              >
                                <option value="">Select product</option>
                                {products
                                  .filter(p => p.name.toLowerCase().includes((bundleFilterTerms[index] || '').toLowerCase()))
                                  .map((p) => (
                                    <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                                  ))}
                              </select>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                                <input type="number" min="1" required className="input-field w-20" value={bp.quantity} onChange={(e) => updateBundleProduct(index, 'quantity', parseInt(e.target.value))} />
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{products.filter(p => p.name.toLowerCase().includes((bundleFilterTerms[index] || '').toLowerCase())).length} products shown</span>
                              {hasMoreProducts && (
                                <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                                  {loadingMoreProducts ? 'Loading...' : 'Load More'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Price (R) *</label>
                        <input type="number" step="0.01" required className="input-field" value={formData.conditions.bundlePrice} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, bundlePrice: e.target.value } })} placeholder="150.00" />
                      </div>
                    </div>
                  )}

                  {formData.type === 'conditional_add_on_price' && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <p className="text-sm text-amber-900 font-semibold mb-2">Conditional Add-On Price (Upsell Unlock)</p>
                        <p className="text-xs text-amber-700">Example: Buy Kellogg's Corn Flakes → unlock Milk (6x1L) for R69.99. The add-on product is optional and not auto-added to cart.</p>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Trigger Product */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Product (Customer Must Buy) *</label>
                          <input
                            type="text"
                            className="input-field mb-2"
                            value={triggerProductFilterTerm}
                            onChange={(e) => setTriggerProductFilterTerm(e.target.value)}
                            placeholder="Filter products..."
                          />
                          <select
                            required
                            className="input-field h-40 overflow-y-auto"
                            size={8}
                            value={formData.conditions.triggerProductId}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, triggerProductId: e.target.value } })}
                          >
                            <option value="">Select trigger product</option>
                            {products
                              .filter(p => p.name.toLowerCase().includes(triggerProductFilterTerm.toLowerCase()))
                              .map((p) => (
                                <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                              ))}
                          </select>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{products.filter(p => p.name.toLowerCase().includes(triggerProductFilterTerm.toLowerCase())).length} products shown</span>
                            {hasMoreProducts && (
                              <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                                {loadingMoreProducts ? 'Loading...' : 'Load More'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            className="input-field"
                            value={formData.conditions.triggerQuantity}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, triggerQuantity: e.target.value } })}
                            placeholder="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Minimum quantity of trigger product required</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Product Price (R) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            className="input-field"
                            value={formData.conditions.triggerPrice}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, triggerPrice: e.target.value } })}
                            placeholder="59.99"
                          />
                          <p className="text-xs text-gray-500 mt-1">Special price customer pays for the trigger product</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Target Product */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Add-On Product (Unlocked at Special Price) *</label>
                          <input
                            type="text"
                            className="input-field mb-2"
                            value={targetProductFilterTerm}
                            onChange={(e) => setTargetProductFilterTerm(e.target.value)}
                            placeholder="Filter products..."
                          />
                          <select
                            required
                            className="input-field h-40 overflow-y-auto"
                            size={8}
                            value={formData.conditions.targetProductId}
                            onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, targetProductId: e.target.value } })}
                          >
                            <option value="">Select add-on product</option>
                            {products
                              .filter(p => p.name.toLowerCase().includes(targetProductFilterTerm.toLowerCase()))
                              .map((p) => (
                                <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                              ))}
                          </select>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{products.filter(p => p.name.toLowerCase().includes(targetProductFilterTerm.toLowerCase())).length} products shown</span>
                            {hasMoreProducts && (
                              <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                                {loadingMoreProducts ? 'Loading...' : 'Load More'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Add-On Quantity *</label>
                            <input
                              type="number"
                              min="1"
                              required
                              className="input-field"
                              value={formData.conditions.targetQuantity}
                              onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, targetQuantity: e.target.value } })}
                              placeholder="1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Override Price (R) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              className="input-field"
                              value={formData.conditions.overridePrice}
                              onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, overridePrice: e.target.value } })}
                              placeholder="69.99"
                            />
                            <p className="text-xs text-gray-500 mt-1">Exact price customer pays for the add-on</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apply To */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Apply Special To</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Single Product</label>
                      <div className="space-y-2">
                        <input type="text" className="input-field" value={productFilterTerm} onChange={(e) => setProductFilterTerm(e.target.value)} placeholder="Filter products..." />
                        <select
                          className="input-field h-48 overflow-y-auto"
                          size={10}
                          value={formData.productId}
                          onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        >
                          <option value="">No product selected (optional)</option>
                          {products
                            .filter(p => p.name.toLowerCase().includes(productFilterTerm.toLowerCase()))
                            .map((p) => (
                              <option key={p._id} value={p._id}>{p.name} {p.price ? `- R${p.price.toFixed(2)}` : ''}</option>
                            ))}
                        </select>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{products.filter(p => p.name.toLowerCase().includes(productFilterTerm.toLowerCase())).length} products shown</span>
                          {hasMoreProducts && (
                            <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-brand-orange hover:text-orange-600 font-medium">
                              {loadingMoreProducts ? 'Loading...' : 'Load More'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select className="input-field" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                        <option value="">Select a category (optional)</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Validity Period */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Validity Period</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input type="datetime-local" className="input-field" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input type="datetime-local" className="input-field" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Additional Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Additional Settings</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stock Limit</label>
                      <input type="number" className="input-field" value={formData.stockLimit} onChange={(e) => setFormData({ ...formData, stockLimit: e.target.value })} placeholder="Leave empty for unlimited" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Limit Per Customer</label>
                      <input type="number" className="input-field" value={formData.conditions.limitPerCustomer} onChange={(e) => setFormData({ ...formData, conditions: { ...formData.conditions, limitPerCustomer: e.target.value } })} placeholder="e.g., 5" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="w-5 h-5 text-brand-orange rounded" />
                      <div>
                        <p className="font-medium text-gray-900">Active</p>
                        <p className="text-sm text-gray-600">Special will be visible and applicable</p>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={formData.featured} onChange={(e) => setFormData({ ...formData, featured: e.target.checked })} className="w-5 h-5 text-brand-orange rounded" />
                      <div>
                        <p className="font-medium text-gray-900">Featured</p>
                        <p className="text-sm text-gray-600">Show in featured specials section</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-4 border-t sticky bottom-0 bg-white">
                  <button type="button" onClick={() => { setShowModal(false); setEditingSpecial(null); resetForm(); }} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || uploading} className="btn-primary flex items-center space-x-2">
                    <Save className="w-5 h-5" />
                    <span>{saving ? 'Saving...' : editingSpecial ? 'Update Special' : 'Create Special'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}