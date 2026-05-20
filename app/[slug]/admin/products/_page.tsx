'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Edit, Trash2, Package, Search, Save, X, Upload,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Link2, Lock, Loader2, RefreshCw, Tag, Check, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';
import { uploadMultipleToCloudinary } from '@/lib/cloudinary';
import { useAuth } from '@/lib/auth-context';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProductVariant {
  _id?: string;
  name: string;
  sku: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  specialPrice?: number;
  stockLevel: number;
  images: string[];
  active: boolean;
  attributes?: { [key: string]: string };
  linkedProductId?: string;
  // Fields editable inline for linked variants (synced back to the child doc)
  linkedName?: string;
  linkedDescription?: string;
  linkedPrice?: number;
  linkedImages?: string[];
  linkedStockLevel?: number;
  linkedActive?: boolean;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  categories: string[];
  tags: string[];
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  barcode?: string;
  stockLevel: number;
  lowStockThreshold: number;
  images: string[];
  hasVariants: boolean;
  variants?: ProductVariant[];
  onSpecial: boolean;
  specialPrice?: number;
  specialStartDate?: string;
  specialEndDate?: string;
  active: boolean;
  featured: boolean;
  unit?: string;
  weight?: number;
  isLinkedVariant?: boolean;
  linkedVariantParentId?: string;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  children?: Category[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty form
// ─────────────────────────────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  description: '',
  categories: [] as string[],
  tags: [] as string[],
  price: '',
  compareAtPrice: '',
  costPrice: '',
  sku: '',
  barcode: '',
  stockLevel: '',
  lowStockThreshold: '10',
  images: [] as string[],
  hasVariants: false,
  variants: [] as ProductVariant[],
  onSpecial: false,
  specialPrice: '',
  specialStartDate: '',
  specialEndDate: '',
  active: true,
  featured: false,
  unit: '',
  weight: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const params = useParams();
  const { branch, loading: branchLoading } = useBranch();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super-admin';

  const [products, setProducts]             = useState<Product[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set());

  // Search
  const [searchTerm, setSearchTerm]         = useState('');
  const [searchLoading, setSearchLoading]   = useState(false);
  const [isSearchMode, setIsSearchMode]     = useState(false);
  const searchDebounceRef                   = useRef<NodeJS.Timeout>();

  // Pagination
  const [currentPage, setCurrentPage]       = useState(1);
  const [itemsPerPage, setItemsPerPage]     = useState(25);
  const [totalProducts, setTotalProducts]   = useState(0);
  const [totalPages, setTotalPages]         = useState(0);

  // ── Link modal state ────────────────────────────────────────────────────────
  const [showLinkModal, setShowLinkModal]           = useState(false);
  const [linkingVariantIndex, setLinkingVariantIndex] = useState<number | null>(null);
  const [linkSearch, setLinkSearch]                 = useState('');
  const [linkResults, setLinkResults]               = useState<Product[]>([]);
  const [linkLoading, setLinkLoading]               = useState(false);
  const [selectedLinkIds, setSelectedLinkIds]       = useState<Set<string>>(new Set());
  const [linkPage, setLinkPage]                     = useState(1);
  const [linkTotalPages, setLinkTotalPages]         = useState(1);
  const [linkLoadingMore, setLinkLoadingMore]       = useState(false);
  const LINK_PAGE_SIZE = 30;

  // Tag input
  const [tagInput, setTagInput] = useState('');
  const [formData, setFormData] = useState({ ...emptyForm });

  // ─────────────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchProducts();
      fetchCategories();
    }
  }, [branchLoading, branch, currentPage, itemsPerPage]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      if (isSearchMode) { setIsSearchMode(false); fetchProducts(); }
      return;
    }
    searchDebounceRef.current = setTimeout(() => performSearch(searchTerm.trim()), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    if (!branch) return;
    setSearchLoading(true);
    setIsSearchMode(true);
    try {
      const res = await fetch(`/api/products?all=true&search=${encodeURIComponent(query)}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.total || 0);
        setTotalPages(1);
      }
    } catch (err) { console.error('Search error:', err); }
    finally { setSearchLoading(false); }
  };

  const fetchProducts = async () => {
    if (!branch) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/products?all=true&page=${currentPage}&limit=${itemsPerPage}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.total || 0);
        setTotalPages(data.totalPages || 0);
      } else { toast.error('Failed to load products'); }
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?all=true&withChildren=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch { console.error('Failed to load categories'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Link modal — paginated fetch
  // ─────────────────────────────────────────────────────────────────────────

  const fetchLinkCandidates = useCallback(async (query: string, page: number, append = false) => {
    if (!branch) return;
    append ? setLinkLoadingMore(true) : setLinkLoading(true);
    try {
      const baseExclude = editingProduct ? `&excludeId=${editingProduct._id}` : '';
      const searchPart  = query.trim().length >= 2
        ? `&search=${encodeURIComponent(query.trim())}`
        : '';
      const res = await fetch(
        `/api/products?all=true&excludeLinked=true${baseExclude}${searchPart}&page=${page}&limit=${LINK_PAGE_SIZE}`
      );
      if (res.ok) {
        const data = await res.json();
        setLinkResults(prev => append ? [...prev, ...(data.products || [])] : (data.products || []));
        setLinkTotalPages(data.totalPages || 1);
        setLinkPage(page);
      }
    } catch { console.error('Link search error'); }
    finally { append ? setLinkLoadingMore(false) : setLinkLoading(false); }
  }, [branch, editingProduct]);

  useEffect(() => {
    if (showLinkModal) {
      setSelectedLinkIds(new Set());
      setLinkPage(1);
      setLinkResults([]);
      fetchLinkCandidates('', 1, false);
    }
  }, [showLinkModal]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLinkPage(1);
      setLinkResults([]);
      fetchLinkCandidates(linkSearch, 1, false);
    }, 300);
    return () => clearTimeout(t);
  }, [linkSearch, fetchLinkCandidates]);

  const handleLinkLoadMore = () => {
    if (linkPage < linkTotalPages && !linkLoadingMore) {
      fetchLinkCandidates(linkSearch, linkPage + 1, true);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Link selection helpers
  // ─────────────────────────────────────────────────────────────────────────

  const toggleLinkSelection = (productId: string) => {
    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  const confirmLinkSelections = () => {
    if (selectedLinkIds.size === 0) { toast.error('Select at least one product to link'); return; }
    const chosen = linkResults.filter(p => selectedLinkIds.has(p._id));

    if (linkingVariantIndex !== null) {
      const product = chosen[0];
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.map((v, i) =>
          i === linkingVariantIndex
            ? {
                name: product.name,
                sku: '',
                barcode: undefined,
                price: product.price,
                stockLevel: product.stockLevel,
                images: product.images,
                active: product.active,
                linkedProductId: product._id,
                linkedName: product.name,
                linkedDescription: product.description,
                linkedPrice: product.price,
                linkedImages: [...product.images],
                linkedStockLevel: product.stockLevel,
                linkedActive: product.active,
              }
            : v
        ),
      }));
      setExpandedVariants(prev => { const next = new Set(prev); next.add(linkingVariantIndex!); return next; });
    } else {
      setFormData(prev => {
        const newVariants: ProductVariant[] = chosen.map(product => ({
          name: product.name,
          sku: '',
          barcode: undefined,
          price: product.price,
          stockLevel: product.stockLevel,
          images: product.images,
          active: product.active,
          linkedProductId: product._id,
          linkedName: product.name,
          linkedDescription: product.description,
          linkedPrice: product.price,
          linkedImages: [...product.images],
          linkedStockLevel: product.stockLevel,
          linkedActive: product.active,
        }));
        const startIdx = prev.variants.length;
        setExpandedVariants(exp => {
          const next = new Set(exp);
          newVariants.forEach((_, i) => next.add(startIdx + i));
          return next;
        });
        return { ...prev, variants: [...prev.variants, ...newVariants] };
      });
    }

    setShowLinkModal(false);
    setLinkingVariantIndex(null);
    setLinkSearch('');
    setSelectedLinkIds(new Set());
    toast.success(
      chosen.length === 1
        ? `Linked "${chosen[0].name}" as variant`
        : `Linked ${chosen.length} products as variants`
    );
  };

  const openLinkModal = (variantIndex: number | null = null) => {
    setLinkingVariantIndex(variantIndex);
    setLinkSearch('');
    setSelectedLinkIds(new Set());
    setLinkResults([]);
    setLinkPage(1);
    setShowLinkModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Tag helpers
  // ─────────────────────────────────────────────────────────────────────────

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!tag || formData.tags.includes(tag)) return;
    setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
  };
  const removeTag = (tag: string) =>
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault(); addTag(tagInput); setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      removeTag(formData.tags[formData.tags.length - 1]);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Image upload
  // ─────────────────────────────────────────────────────────────────────────

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variantIndex?: number,
    isLinkedField = false
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (Array.from(files).some(f => !validTypes.includes(f.type))) {
      toast.error('Only JPG, PNG, and WebP images are allowed'); return;
    }
    if (Array.from(files).some(f => f.size > 10 * 1024 * 1024)) {
      toast.error('Images must be under 10MB'); return;
    }
    setUploading(true);
    try {
      const urls = await uploadMultipleToCloudinary(Array.from(files));
      if (variantIndex !== undefined) {
        setFormData(prev => ({
          ...prev,
          variants: prev.variants.map((v, i) => {
            if (i !== variantIndex) return v;
            if (isLinkedField) {
              return { ...v, linkedImages: [...(v.linkedImages || []), ...urls] };
            }
            return { ...v, images: [...v.images, ...urls] };
          }),
        }));
      } else {
        setFormData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
      }
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} uploaded!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number, variantIndex?: number, isLinkedField = false) => {
    if (variantIndex !== undefined) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.map((v, i) => {
          if (i !== variantIndex) return v;
          if (isLinkedField) {
            return { ...v, linkedImages: (v.linkedImages || []).filter((_, idx) => idx !== index) };
          }
          return { ...v, images: v.images.filter((_, idx) => idx !== index) };
        }),
      }));
    } else {
      setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Variant helpers
  // ─────────────────────────────────────────────────────────────────────────

  const addVariant = () =>
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { name: '', sku: '', barcode: '', stockLevel: 0, images: [], active: true }],
    }));

  const removeVariant = (index: number) => {
    setFormData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
    setExpandedVariants(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
  };

  const updateVariant = (index: number, field: string, value: any) =>
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));

  const toggleVariantExpanded = (index: number) =>
    setExpandedVariants(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });

  // ─────────────────────────────────────────────────────────────────────────
  // Form reset / edit
  // ─────────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setTagInput('');
    setExpandedVariants(new Set());
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    // For linked variants, pre-populate the linked* fields from the variant data
    const variants = (product.variants || []).map(v => ({
      ...v,
      linkedName: v.linkedProductId ? v.name : undefined,
      linkedImages: v.linkedProductId ? [...v.images] : undefined,
      linkedPrice: v.linkedProductId ? v.price : undefined,
      linkedStockLevel: v.linkedProductId ? v.stockLevel : undefined,
      linkedActive: v.linkedProductId ? v.active : undefined,
    }));
    setFormData({
      name: product.name,
      description: product.description,
      categories: product.categories || [],
      tags: product.tags || [],
      price: product.price.toString(),
      compareAtPrice: product.compareAtPrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      sku: product.sku,
      barcode: product.barcode || '',
      stockLevel: product.stockLevel.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
      images: product.images,
      hasVariants: product.hasVariants || false,
      variants,
      onSpecial: product.onSpecial,
      specialPrice: product.specialPrice?.toString() || '',
      specialStartDate: product.specialStartDate || '',
      specialEndDate: product.specialEndDate || '',
      active: product.active,
      featured: product.featured,
      unit: product.unit || '',
      weight: product.weight?.toString() || '',
    });
    setTagInput('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Product deleted'); fetchProducts(); }
      else { const data = await res.json(); toast.error(data.error || 'Failed to delete product'); }
    } catch { toast.error('An error occurred'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Submit — also patch linked child products inline
  // ─────────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.categories.length === 0) { toast.error('Please select at least one category'); return; }
      if (formData.hasVariants && formData.variants.length === 0) {
        toast.error('Please add at least one variant or disable variants'); return;
      }

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        compareAtPrice: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : undefined,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        stockLevel: parseInt(formData.stockLevel),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
        specialPrice: formData.specialPrice ? parseFloat(formData.specialPrice) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        tags: formData.tags,
        variants: formData.hasVariants
          ? formData.variants.map(v => ({
              ...v,
              price: v.price ? parseFloat(v.price as any) : undefined,
              compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice as any) : undefined,
              specialPrice: v.specialPrice ? parseFloat(v.specialPrice as any) : undefined,
            }))
          : undefined,
      };

      const url    = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to save product');
        return;
      }

      // ── Patch linked child products with inline edits ──────────────────────
      const linkedVariants = formData.variants.filter(v => v.linkedProductId);
      if (linkedVariants.length > 0) {
        await Promise.allSettled(
          linkedVariants.map(async v => {
            // Fetch current child data first so we don't nuke fields we didn't touch
            const childRes = await fetch(`/api/products/${v.linkedProductId}`);
            if (!childRes.ok) return;
            const { product: childDoc } = await childRes.json();

            const patchData: any = {};
            if (v.linkedName !== undefined && v.linkedName !== childDoc.name)
              patchData.name = v.linkedName;
            if (v.linkedPrice !== undefined && v.linkedPrice !== childDoc.price)
              patchData.price = v.linkedPrice;
            if (v.linkedStockLevel !== undefined && v.linkedStockLevel !== childDoc.stockLevel)
              patchData.stockLevel = v.linkedStockLevel;
            if (v.linkedActive !== undefined && v.linkedActive !== childDoc.active)
              patchData.active = v.linkedActive;
            if (
              v.linkedImages !== undefined &&
              JSON.stringify(v.linkedImages) !== JSON.stringify(childDoc.images)
            ) patchData.images = v.linkedImages;

            if (Object.keys(patchData).length === 0) return; // nothing changed

            await fetch(`/api/products/${v.linkedProductId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...childDoc, ...patchData }),
            });
          })
        );
      }

      toast.success(editingProduct ? 'Product updated!' : 'Product created!');
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      isSearchMode ? performSearch(searchTerm) : fetchProducts();
    } catch { toast.error('An error occurred'); }
    finally { setSaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Table helpers
  // ─────────────────────────────────────────────────────────────────────────

  const getTotalStock = (product: Product) => {
    if (product.hasVariants && product.variants)
      return product.variants.reduce((sum, v) => sum + v.stockLevel, 0);
    return product.stockLevel;
  };

  const handleCategoryToggle = (categorySlug: string) =>
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categorySlug)
        ? prev.categories.filter(c => c !== categorySlug)
        : [...prev.categories, categorySlug],
    }));

  const renderCategoryCheckboxes = (cats: Category[], level = 0): JSX.Element[] =>
    cats.flatMap(cat => [
      <label
        key={cat._id}
        className={`flex items-center space-x-2 cursor-pointer p-2 hover:bg-orange-50 rounded-lg transition-colors ${level > 0 ? `ml-${level * 4}` : ''}`}
      >
        <input
          type="checkbox"
          checked={formData.categories.includes(cat.slug)}
          onChange={() => handleCategoryToggle(cat.slug)}
          className="w-4 h-4 accent-orange-500 rounded"
        />
        <span className="text-sm text-gray-700">{cat.name}</span>
      </label>,
      ...(cat.children?.length ? renderCategoryCheckboxes(cat.children, level + 1) : []),
    ]);

  const priceDisabled = !!editingProduct && !isSuperAdmin;

  // ─────────────────────────────────────────────────────────────────────────
  // Early returns
  // ─────────────────────────────────────────────────────────────────────────

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-500 mt-1">
              {branch.displayName} &mdash;{' '}
              <span className="font-semibold text-orange-500">{totalProducts} total</span>
            </p>
          </div>
          <button
            onClick={() => { setEditingProduct(null); resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add Product
          </button>
        </div>

        {/* Search & Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              {searchLoading && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />
              )}
              <input
                type="text"
                placeholder="Search by name, SKU, barcode, or tag…"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setIsSearchMode(false); fetchProducts(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">Show:</span>
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-500 whitespace-nowrap">per page</span>
            </div>
            {!isSuperAdmin && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Price editing: Super Admin only</span>
              </div>
            )}
          </div>
          {isSearchMode && !searchLoading && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-orange-500">{products.length}</span> results for &ldquo;{searchTerm}&rdquo;
              </p>
              <button
                onClick={() => { setSearchTerm(''); setIsSearchMode(false); fetchProducts(); }}
                className="text-xs text-orange-500 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Back to all
              </button>
            </div>
          )}
        </div>

        {/* ── Products Table ── */}
        {loading && !isSearchMode ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-200">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? `No results for "${searchTerm}"` : 'No products yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {searchTerm ? 'Try different keywords or tags' : 'Add your first product to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Categories</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Status</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products
                      // Hide child linked variants from the table — they appear under their parent
                      .filter(p => !p.isLinkedVariant)
                      .map((product) => {
                        const stock = getTotalStock(product);
                        const stockColor =
                          stock > product.lowStockThreshold
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : stock > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200';

                        return (
                          <tr key={product._id} className="hover:bg-orange-50/30 transition-colors group">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                                  {product.images[0] ? (
                                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-5 h-5 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                                  {product.hasVariants && product.variants && product.variants.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      {/* Show variant thumbnails */}
                                      <div className="flex -space-x-1.5">
                                        {product.variants.slice(0, 4).map((v, vi) => (
                                          <div key={vi} className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 overflow-hidden">
                                            {v.images?.[0]
                                              ? <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover" />
                                              : <div className="w-full h-full bg-orange-200" />
                                            }
                                          </div>
                                        ))}
                                      </div>
                                      <p className="text-xs text-gray-400">
                                        {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                                        {product.variants.some(v => v.linkedProductId) && (
                                          <span className="ml-1 text-blue-400">(linked)</span>
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-600">{product.sku}</code>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {product.categories?.slice(0, 2).map((cat, i) => (
                                  <span key={i} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-lg border border-blue-100">{cat}</span>
                                ))}
                                {(product.categories?.length || 0) > 2 && (
                                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-lg">+{product.categories.length - 2}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {(product.tags || []).slice(0, 3).map((tag, i) => (
                                  <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-lg border border-purple-100">
                                    <Tag className="w-2.5 h-2.5" />{tag}
                                  </span>
                                ))}
                                {(product.tags?.length || 0) > 3 && (
                                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-lg">+{product.tags.length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-bold text-gray-900 text-sm">R{(product.specialPrice || product.price).toFixed(2)}</p>
                              {product.specialPrice && (
                                <span className="text-xs text-orange-500 font-medium">On Special</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${stockColor}`}>
                                {stock} units
                              </span>
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              <div className="flex flex-col gap-1">
                                <span className={`text-xs px-2 py-0.5 rounded-lg w-fit font-medium ${product.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                                  {product.active ? 'Active' : 'Hidden'}
                                </span>
                                {product.featured && (
                                  <span className="text-xs px-2 py-0.5 rounded-lg w-fit bg-blue-50 text-blue-600 border border-blue-200 font-medium">Featured</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(product)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors" title="Edit product">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(product._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete product">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {!isSearchMode && totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) page = i + 1;
                    else if (currentPage <= 3) page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = currentPage - 2 + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-xl text-sm font-medium border transition-colors ${currentPage === page ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
           MULTI-SELECT LINK MODAL (with Load More)
         ══════════════════════════════════════════════════════════ */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-orange-500" />
                  {linkingVariantIndex !== null ? 'Link a Product as Variant' : 'Link Products as Variants'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {linkingVariantIndex !== null
                    ? 'Select a product to replace this variant slot'
                    : 'Select one or more products to add as linked variants'}
                </p>
              </div>
              <button
                onClick={() => { setShowLinkModal(false); setLinkingVariantIndex(null); setLinkSearch(''); setSelectedLinkIds(new Set()); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {linkLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />
                )}
                <input
                  type="text"
                  placeholder="Search by product name or SKU…"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {selectedLinkIds.size > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                    {selectedLinkIds.size} selected
                  </span>
                  <button type="button" onClick={() => setSelectedLinkIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1 min-h-0">
              {linkResults.length === 0 && !linkLoading && (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {linkSearch ? 'No products found' : 'No linkable products found'}
                </div>
              )}
              {linkResults.map(product => {
                const isSelected = selectedLinkIds.has(product._id);
                return (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => toggleLinkSelection(product._id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                      isSelected ? 'bg-orange-50 border-orange-300 shadow-sm' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 group-hover:border-orange-400'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {product.images[0]
                        ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate transition-colors ${isSelected ? 'text-orange-700' : 'text-gray-900 group-hover:text-gray-700'}`}>
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        SKU: {product.sku} &bull; R{product.price.toFixed(2)} &bull;{' '}
                        <span className={product.stockLevel === 0 ? 'text-red-400' : 'text-gray-400'}>
                          {product.stockLevel} in stock
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* ── Load More button ── */}
              {linkPage < linkTotalPages && (
                <div className="pt-2 pb-1">
                  <button
                    type="button"
                    onClick={handleLinkLoadMore}
                    disabled={linkLoadingMore}
                    className="w-full py-2.5 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {linkLoadingMore
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                      : <>Load More <span className="text-orange-400 font-normal text-xs">(page {linkPage} of {linkTotalPages})</span></>
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t flex-shrink-0 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">Already-linked variants are hidden</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowLinkModal(false); setLinkingVariantIndex(null); setLinkSearch(''); setSelectedLinkIds(new Set()); }}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLinkSelections}
                  disabled={selectedLinkIds.size === 0}
                  className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {selectedLinkIds.size > 1 ? `Link ${selectedLinkIds.size} Products` : 'Link Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           PRODUCT MODAL
         ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                {!isSuperAdmin && editingProduct && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3" /> Price fields are view-only. Contact a Super Admin to change prices.
                  </p>
                )}
              </div>
              <button
                onClick={() => { setShowModal(false); setEditingProduct(null); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[calc(100vh-160px)] overflow-y-auto">

              {/* Basic Info */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Basic Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name *</label>
                    <input type="text" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                    <textarea required rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Categories * <span className="text-gray-400 font-normal">(select one or more)</span></label>
                    <div className="border border-gray-200 rounded-xl p-3 max-h-44 overflow-y-auto bg-gray-50">
                      {categories.length > 0 ? renderCategoryCheckboxes(categories) : (
                        <p className="text-sm text-gray-400 p-2">No categories available</p>
                      )}
                    </div>
                    {formData.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {formData.categories.map(c => (
                          <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-lg font-medium">
                            {c}<button type="button" onClick={() => handleCategoryToggle(c)}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Search Tags
                      <span className="ml-2 text-xs text-gray-400 font-normal">Press Enter, comma, or space to add</span>
                    </label>
                    <div
                      className="flex flex-wrap gap-1.5 items-center min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition-all cursor-text"
                      onClick={() => document.getElementById('tag-input')?.focus()}
                    >
                      {formData.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium">
                          <Tag className="w-2.5 h-2.5" />{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-purple-900"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      <input
                        id="tag-input"
                        type="text"
                        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-700 placeholder-gray-400"
                        placeholder={formData.tags.length === 0 ? 'e.g. dairy, organic, gluten-free…' : ''}
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={() => { if (tagInput.trim()) { addTag(tagInput); setTagInput(''); } }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU *</label>
                    <input type="text" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Barcode</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
                  </div>
                </div>
              </section>

              {/* Variants Toggle */}
              <section className="border-t pt-6">
                <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasVariants}
                    onChange={e => setFormData({ ...formData, hasVariants: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-orange-500 rounded"
                  />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">This product has variants</p>
                    <p className="text-xs text-gray-500 mt-0.5">e.g. different flavours, sizes, or colours. You can also link existing products as variants.</p>
                  </div>
                </label>
              </section>

              {/* ── Variants Section ── */}
              {formData.hasVariants && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Variants ({formData.variants.length})</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openLinkModal(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Link Existing
                      </button>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Variant
                      </button>
                    </div>
                  </div>

                  {formData.variants.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 mb-4">No variants added yet</p>
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={addVariant} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors">
                          <Plus className="w-4 h-4" /> New Variant
                        </button>
                        <button type="button" onClick={() => openLinkModal(null)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                          <Link2 className="w-4 h-4" /> Link Products
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.variants.map((variant, index) => (
                        <div key={index} className={`border rounded-xl overflow-hidden ${variant.linkedProductId ? 'border-blue-200' : 'border-gray-200'}`}>
                          {/* Variant header */}
                          <div className={`flex items-center justify-between px-4 py-3 border-b ${variant.linkedProductId ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                            <button type="button" onClick={() => toggleVariantExpanded(index)} className="flex items-center gap-2 font-medium text-gray-800 text-sm">
                              {expandedVariants.has(index) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              <span>{variant.linkedProductId ? (variant.linkedName || variant.name) : (variant.name || `Variant ${index + 1}`)}</span>
                              {variant.linkedProductId && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-lg border border-blue-200 font-medium">
                                  <Link2 className="w-2.5 h-2.5" /> Linked
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => openLinkModal(index)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Replace with a different linked product">
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => removeVariant(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Variant body */}
                          {expandedVariants.has(index) && (
                            <div className="p-4 space-y-4">

                              {/* ── LINKED variant: full inline edit of child product ── */}
                              {variant.linkedProductId ? (
                                <>
                                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                    <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700">
                                      Changes here will be saved directly to the linked product when you click <strong>Update Product</strong>.
                                    </p>
                                  </div>

                                  <div className="grid md:grid-cols-2 gap-4">
                                    {/* Display name for this variant slot */}
                                    <div className="md:col-span-2">
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Variant Label (shown in picker)</label>
                                      <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        value={variant.name}
                                        onChange={e => updateVariant(index, 'name', e.target.value)}
                                        placeholder="e.g. Apple, 500g"
                                      />
                                    </div>

                                    {/* Linked product name */}
                                    <div className="md:col-span-2">
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Product Name (on linked product)</label>
                                      <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        value={variant.linkedName ?? variant.name}
                                        onChange={e => updateVariant(index, 'linkedName', e.target.value)}
                                      />
                                    </div>

                                    {/* Price */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                                        Price (R) {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                                      </label>
                                      <input
                                        type="number" step="0.01"
                                        disabled={priceDisabled}
                                        className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-blue-200 bg-blue-50 focus:ring-2 focus:ring-blue-400'}`}
                                        value={variant.linkedPrice ?? variant.price ?? ''}
                                        onChange={e => !priceDisabled && updateVariant(index, 'linkedPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      />
                                    </div>

                                    {/* Stock */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Stock Level</label>
                                      <input
                                        type="number"
                                        className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        value={variant.linkedStockLevel ?? variant.stockLevel}
                                        onChange={e => updateVariant(index, 'linkedStockLevel', parseInt(e.target.value) || 0)}
                                      />
                                    </div>

                                    {/* Active toggle */}
                                    <div className="md:col-span-2">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={variant.linkedActive ?? variant.active}
                                          onChange={e => updateVariant(index, 'linkedActive', e.target.checked)}
                                          className="w-4 h-4 accent-orange-500 rounded"
                                        />
                                        <span className="text-xs font-medium text-gray-600">Product Active</span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* Linked product images */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Product Images (linked)</label>
                                    <label className={`flex items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                                      <div className="text-center">
                                        <Upload className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                        <span className="text-xs text-blue-500">{uploading ? 'Uploading…' : 'Upload images'}</span>
                                      </div>
                                      <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleImageUpload(e, index, true)} disabled={uploading} />
                                    </label>
                                    {(variant.linkedImages ?? variant.images).length > 0 && (
                                      <div className="grid grid-cols-5 gap-2 mt-2">
                                        {(variant.linkedImages ?? variant.images).map((img, imgIdx) => (
                                          <div key={imgIdx} className="relative group">
                                            <img src={img} alt="" className="w-full h-16 object-cover rounded-lg border border-blue-100" />
                                            <button type="button" onClick={() => removeImage(imgIdx, index, true)} className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                            {imgIdx === 0 && <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-[9px] px-1 py-0.5 rounded font-medium">Main</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* ── REGULAR (non-linked) variant ── */
                                <>
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Variant Name *</label>
                                      <input
                                        type="text" required
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        value={variant.name}
                                        onChange={e => updateVariant(index, 'name', e.target.value)}
                                        placeholder="e.g. Apple, 500g"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">SKU *</label>
                                      <input type="text" required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={variant.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Barcode</label>
                                      <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={variant.barcode || ''} onChange={e => updateVariant(index, 'barcode', e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Stock Level *</label>
                                      <input type="number" required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={variant.stockLevel} onChange={e => updateVariant(index, 'stockLevel', parseInt(e.target.value) || 0)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                                        Price Override (R) {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                                      </label>
                                      <input
                                        type="number" step="0.01" disabled={priceDisabled}
                                        className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-orange-400'}`}
                                        value={variant.price || ''}
                                        onChange={e => !priceDisabled && updateVariant(index, 'price', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder="Leave empty to use base price"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                                        Compare at Price (R) {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                                      </label>
                                      <input
                                        type="number" step="0.01" disabled={priceDisabled}
                                        className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-orange-400'}`}
                                        value={variant.compareAtPrice || ''}
                                        onChange={e => !priceDisabled && updateVariant(index, 'compareAtPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Variant Images</label>
                                    <label className={`flex items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
                                      <div className="text-center">
                                        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <span className="text-xs text-gray-500">{uploading ? 'Uploading…' : 'Upload images'}</span>
                                      </div>
                                      <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleImageUpload(e, index, false)} disabled={uploading} />
                                    </label>
                                    {variant.images.length > 0 && (
                                      <div className="grid grid-cols-5 gap-2 mt-2">
                                        {variant.images.map((img, imgIdx) => (
                                          <div key={imgIdx} className="relative group">
                                            <img src={img} alt="" className="w-full h-16 object-cover rounded-lg" />
                                            <button type="button" onClick={() => removeImage(imgIdx, index, false)} className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={variant.active} onChange={e => updateVariant(index, 'active', e.target.checked)} className="w-4 h-4 accent-orange-500 rounded" />
                                    <span className="text-xs font-medium text-gray-600">Variant Active</span>
                                  </label>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Pricing (non-variant) */}
              {!formData.hasVariants && (
                <>
                  <section className="border-t pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pricing</h3>
                      {priceDisabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-50 text-amber-600 rounded-lg border border-amber-200 font-medium">
                          <Lock className="w-3 h-3" /> View Only
                        </span>
                      )}
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { label: 'Price (R) *', key: 'price', required: true },
                        { label: 'Compare at Price (R)', key: 'compareAtPrice', required: false },
                        { label: 'Cost Price (R)', key: 'costPrice', required: false },
                      ].map(({ label, key, required }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                            {label} {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                          </label>
                          <input
                            type="number" step="0.01"
                            required={required && !priceDisabled}
                            disabled={priceDisabled}
                            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-orange-400'}`}
                            value={(formData as any)[key]}
                            onChange={e => !priceDisabled && setFormData({ ...formData, [key]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Special Pricing</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.onSpecial} onChange={e => setFormData({ ...formData, onSpecial: e.target.checked })} className="w-4 h-4 accent-orange-500 rounded" />
                        <span className="text-sm font-medium text-gray-700">On Special</span>
                      </label>
                    </div>
                    {formData.onSpecial && (
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                            Special Price (R) * {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                          </label>
                          <input
                            type="number" step="0.01" required={formData.onSpecial} disabled={priceDisabled}
                            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-orange-400'}`}
                            value={formData.specialPrice}
                            onChange={e => !priceDisabled && setFormData({ ...formData, specialPrice: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                          <input type="date" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.specialStartDate} onChange={e => setFormData({ ...formData, specialStartDate: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                          <input type="date" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.specialEndDate} onChange={e => setFormData({ ...formData, specialEndDate: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Inventory</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Level *</label>
                        <input type="number" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.stockLevel} onChange={e => setFormData({ ...formData, stockLevel: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Low Stock Threshold *</label>
                        <input type="number" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: e.target.value })} />
                      </div>
                    </div>
                  </section>
                </>
              )}

              {formData.hasVariants && (
                <section className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Base Product Pricing</h3>
                  <p className="text-xs text-gray-400 mb-4">Defaults for variants that don&apos;t override pricing</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        Base Price (R) * {priceDisabled && <Lock className="w-3 h-3 text-amber-500" />}
                      </label>
                      <input type="number" step="0.01" required disabled={priceDisabled}
                        className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none transition-all ${priceDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-orange-400'}`}
                        value={formData.price} onChange={e => !priceDisabled && setFormData({ ...formData, price: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Level (Base) *</label>
                      <input type="number" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.stockLevel} onChange={e => setFormData({ ...formData, stockLevel: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Low Stock Threshold *</label>
                      <input type="number" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: e.target.value })} />
                    </div>
                  </div>
                </section>
              )}

              {/* Product Details */}
              <section className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Product Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit of Measurement</label>
                    <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                      <option value="">Select unit…</option>
                      {['g', 'kg', 'ml', 'L', 'ea', 'pack', 'bag', 'bottle', 'box', 'can'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity / Size</label>
                    <input type="number" step="0.01" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="e.g. 500, 1.5" />
                    {formData.unit && formData.weight && (
                      <p className="text-xs text-gray-400 mt-1">Displays as: {formData.weight}{formData.unit}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Images */}
              <section className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  {formData.hasVariants ? 'Default Product Images' : 'Product Images'}
                </h3>
                <label className={`flex items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors mb-4 ${uploading ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'}`}>
                  <div className="text-center">
                    <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                    <span className="text-sm text-gray-500">{uploading ? 'Uploading…' : 'Click to upload images'}</span>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                  </div>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleImageUpload(e)} disabled={uploading} />
                </label>
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {formData.images.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} alt="" className="w-full h-24 object-cover rounded-xl border border-gray-100" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                        {i === 0 && <span className="absolute bottom-1.5 left-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-lg font-medium">Main</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Status */}
              <section className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Status</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { key: 'active', label: 'Active', desc: 'Product visible to customers' },
                    { key: 'featured', label: 'Featured', desc: 'Show in featured products section' },
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

              {/* Form Actions */}
              <div className="sticky bottom-0 bg-white border-t pt-4 pb-1 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingProduct(null); resetForm(); }}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}