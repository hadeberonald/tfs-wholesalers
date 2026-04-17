'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Edit, Trash2, Gift, Search, Save, X, Upload,
  Package, Loader2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  stockLevel: number;
}

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
  active: boolean;
  featured: boolean;
  stockLevel: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCombosPage() {
  const { branch, loading: branchLoading } = useBranch();

  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [uploading, setUploading] = useState(false);

  // Combo search (client-side on loaded list)
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCombos = combos.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Product search for pickers
  const [itemFilterTerms, setItemFilterTerms] = useState<{ [k: number]: string }>({});
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const PRODUCTS_PER_PAGE = 100;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    items: [] as ComboItem[],
    comboPrice: '',
    images: [] as string[],
    active: true,
    featured: false,
    stockLevel: '',
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchCombos();
      fetchProducts();
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
        setProducts(page === 1 ? newProducts : prev => [...prev, ...newProducts]);
        setHasMoreProducts(newProducts.length === PRODUCTS_PER_PAGE);
        setProductPage(page);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  const loadMoreProducts = () => {
    if (!loadingMoreProducts && hasMoreProducts) fetchProducts(productPage + 1);
  };

  const fetchCombos = async () => {
    if (!branch) return;
    try {
      setLoading(true);
      const res = await fetch('/api/combos?all=true');
      if (res.ok) {
        const data = await res.json();
        setCombos(data.combos || []);
      } else {
        toast.error('Failed to load combos');
      }
    } catch {
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, WebP allowed'); return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
      toast.success('Image uploaded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const addComboItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', productName: '', quantity: 1 }],
    }));
  };

  const updateComboItem = (index: number, field: keyof ComboItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        if (field === 'productId') {
          const product = products.find(p => p._id === value);
          return { ...item, productId: value, productName: product?.name || item.productName };
        }
        return { ...item, [field]: value };
      }),
    }));
  };

  const removeComboItem = (index: number) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    setItemFilterTerms(prev => {
      const next = { ...prev };
      delete next[index];
      return Object.fromEntries(
        Object.entries(next).map(([k, v]) => [parseInt(k) > index ? parseInt(k) - 1 : parseInt(k), v])
      );
    });
  };

  const calculateRegularPrice = () =>
    formData.items.reduce((total, item) => {
      const product = products.find(p => p._id === item.productId);
      return total + (product?.price || 0) * item.quantity;
    }, 0);

  const resetForm = () => {
    setFormData({ name: '', description: '', items: [], comboPrice: '', images: [], active: true, featured: false, stockLevel: '' });
    setItemFilterTerms({});
  };

  const handleEdit = (combo: Combo) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name,
      description: combo.description,
      items: combo.items,
      comboPrice: combo.comboPrice.toString(),
      images: combo.images,
      active: combo.active,
      featured: combo.featured,
      stockLevel: combo.stockLevel.toString(),
    });
    setItemFilterTerms({});
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this combo?')) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Combo deleted'); fetchCombos(); }
      else toast.error('Failed to delete combo');
    } catch { toast.error('An error occurred'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.items.length === 0) { toast.error('Add at least one product'); setSaving(false); return; }
      const regularPrice = calculateRegularPrice();
      const comboPrice = parseFloat(formData.comboPrice);
      if (comboPrice >= regularPrice) { toast.error('Combo price must be less than regular price'); setSaving(false); return; }

      const comboData = {
        name: formData.name,
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: formData.description,
        items: formData.items,
        comboPrice,
        regularPrice,
        images: formData.images,
        active: formData.active,
        featured: formData.featured,
        stockLevel: parseInt(formData.stockLevel),
      };

      const url = editingCombo ? `/api/combos/${editingCombo._id}` : '/api/combos';
      const method = editingCombo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comboData),
      });

      if (res.ok) {
        toast.success(editingCombo ? 'Combo updated!' : 'Combo created!');
        setShowModal(false); setEditingCombo(null); resetForm(); fetchCombos();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save combo');
      }
    } catch { toast.error('An error occurred'); }
    finally { setSaving(false); }
  };

  const regularPrice = calculateRegularPrice();
  const savings = formData.comboPrice ? regularPrice - parseFloat(formData.comboPrice) : 0;
  const discountPercent = regularPrice > 0 ? Math.round((savings / regularPrice) * 100) : 0;

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
            <h1 className="text-3xl font-bold text-gray-900">Combo Deals</h1>
            <p className="text-gray-500 mt-1">
              {branch.displayName} &mdash; <span className="font-semibold text-orange-500">{combos.length} total</span>
            </p>
          </div>
          <button
            onClick={() => { setEditingCombo(null); resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Combo
          </button>
        </div>

        {/* ── Search ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search combos by name or description…"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
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
              <span className="font-semibold text-orange-500">{filteredCombos.length}</span> of {combos.length} combos
            </p>
          )}
        </div>

        {/* ── Table ── */}
        {filteredCombos.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-200">
            <Gift className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? `No combos matching "${searchTerm}"` : 'No combos yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {searchTerm ? 'Try different keywords' : 'Bundle products together for great deals'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Add Combo
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Combo</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pricing</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Stock</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCombos.map(combo => {
                    const s = combo.regularPrice - combo.comboPrice;
                    const d = Math.round((s / combo.regularPrice) * 100);
                    return (
                      <tr key={combo._id} className="hover:bg-orange-50/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {combo.images[0] ? (
                                <img src={combo.images[0]} alt={combo.name} className="w-full h-full object-cover" />
                              ) : (
                                <Gift className="w-5 h-5 text-purple-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{combo.name}</p>
                              <p className="text-xs text-gray-400 line-clamp-1">{combo.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200">
                            <Package className="w-3 h-3" />
                            {combo.items.length} products
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-orange-500 text-sm">R{combo.comboPrice.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 line-through">R{combo.regularPrice.toFixed(2)}</p>
                          <p className="text-xs text-emerald-600 font-semibold">Save {d}%</p>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            combo.stockLevel > 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : combo.stockLevel > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {combo.stockLevel} units
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2.5 py-1 rounded-lg w-fit font-medium border ${combo.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {combo.active ? 'Active' : 'Hidden'}
                            </span>
                            {combo.featured && (
                              <span className="text-xs px-2.5 py-1 rounded-lg w-fit bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                                Featured
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(combo)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(combo._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
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
        )}
      </div>

      {/* ══════════════════════════════
              COMBO MODAL
         ══════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCombo ? 'Edit Combo' : 'Add New Combo'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingCombo(null); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[calc(100vh-160px)] overflow-y-auto">

              {/* Basic Info */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Combo Name *</label>
                    <input type="text" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Family Braai Pack" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                    <textarea required rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="What's included in this combo…" />
                  </div>
                </div>
              </section>

              {/* Combo Items */}
              <section className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Combo Items</h3>
                  <button
                    type="button"
                    onClick={addComboItem}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl border border-orange-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">No products added yet</p>
                    <button type="button" onClick={addComboItem} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors">
                      <Plus className="w-4 h-4" /> Add First Product
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.items.map((item, index) => {
                      const product = products.find(p => p._id === item.productId);
                      const itemTotal = (product?.price || 0) * item.quantity;
                      const filterTerm = itemFilterTerms[index] || '';
                      const filtered = products.filter(p =>
                        p.name.toLowerCase().includes(filterTerm.toLowerCase())
                      );

                      return (
                        <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span>
                              <span className="text-sm font-semibold text-gray-700">
                                {item.productName || 'Select a product'}
                              </span>
                            </div>
                            <button type="button" onClick={() => removeComboItem(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Product *</label>
                              <div className="relative mb-1.5">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="text"
                                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                                  value={filterTerm}
                                  onChange={e => setItemFilterTerms(prev => ({ ...prev, [index]: e.target.value }))}
                                  placeholder="Filter products…"
                                />
                              </div>
                              <select
                                required
                                className="w-full border border-gray-200 rounded-xl text-xs p-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                                size={5}
                                value={item.productId}
                                onChange={e => updateComboItem(index, 'productId', e.target.value)}
                              >
                                <option value="">Select product…</option>
                                {filtered.map(p => (
                                  <option key={p._id} value={p._id}>
                                    {p.name} — R{p.price.toFixed(2)}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                                <span>{filtered.length} shown</span>
                                {hasMoreProducts && (
                                  <button type="button" onClick={loadMoreProducts} disabled={loadingMoreProducts} className="text-orange-500 hover:text-orange-700 font-medium">
                                    {loadingMoreProducts ? 'Loading…' : 'Load more'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                              <input
                                type="number" min="1" required
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                value={item.quantity}
                                onChange={e => updateComboItem(index, 'quantity', parseInt(e.target.value))}
                              />
                              {product && (
                                <div className="mt-2 p-2 bg-white rounded-lg border border-gray-100 text-xs">
                                  <p className="text-gray-400">Item total</p>
                                  <p className="font-bold text-gray-800">R{itemTotal.toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Pricing */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Pricing</h3>
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Regular Price (Total)</span>
                    <span className="font-bold text-gray-900">R{regularPrice.toFixed(2)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Customer Saves</span>
                      <span className="font-bold text-emerald-600">R{savings.toFixed(2)} ({discountPercent}%)</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Combo Price (R) *</label>
                  <input
                    type="number" step="0.01" required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={formData.comboPrice}
                    onChange={e => setFormData({ ...formData, comboPrice: e.target.value })}
                    placeholder={`Must be less than R${regularPrice.toFixed(2)}`}
                  />
                </div>
              </section>

              {/* Image */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Combo Image</h3>
                <label className={`flex items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors mb-4 ${uploading ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
                  <div className="text-center">
                    <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                    <span className="text-sm text-gray-500">{uploading ? 'Uploading…' : 'Click to upload image'}</span>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {formData.images.map((image, i) => (
                      <div key={i} className="relative group">
                        <img src={image} alt="" className="w-full h-24 object-cover rounded-xl border border-gray-100" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Stock & Status */}
              <section className="border-t pt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Inventory & Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Level *</label>
                    <input type="number" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={formData.stockLevel} onChange={e => setFormData({ ...formData, stockLevel: e.target.value })} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      { key: 'active', label: 'Active', desc: 'Combo visible to customers' },
                      { key: 'featured', label: 'Featured', desc: 'Show in featured combos section' },
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
                </div>
              </section>

              {/* Actions */}
              <div className="sticky bottom-0 bg-white border-t pt-4 pb-1 flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowModal(false); setEditingCombo(null); resetForm(); }} className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : editingCombo ? 'Update Combo' : 'Create Combo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}