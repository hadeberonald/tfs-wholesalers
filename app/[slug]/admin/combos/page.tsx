'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit, Trash2, Gift, Search, Save, X, Upload, Package } from 'lucide-react';
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
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();

  const [combos, setCombos]     = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [uploading, setUploading]       = useState(false);

  // ── Per-item filter terms (same pattern as bundleFilterTerms in specials) ──
  const [itemFilterTerms, setItemFilterTerms] = useState<{ [key: number]: string }>({});

  // ── Product pagination (identical to specials) ──
  const [productPage, setProductPage]               = useState(1);
  const [hasMoreProducts, setHasMoreProducts]       = useState(true);
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

  // ── Paginated product fetch — identical to specials ──
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
    } catch (error) {
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
      toast.success('Image uploaded successfully!');
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
      // re-index keys above the removed index
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
    if (!confirm('Are you sure you want to delete this combo?')) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Combo deleted');
        fetchCombos();
      } else {
        toast.error('Failed to delete combo');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.items.length === 0) {
        toast.error('Please add at least one product to the combo');
        setSaving(false);
        return;
      }

      const regularPrice = calculateRegularPrice();
      const comboPrice   = parseFloat(formData.comboPrice);

      if (comboPrice >= regularPrice) {
        toast.error('Combo price must be less than regular price');
        setSaving(false);
        return;
      }

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

      const url    = editingCombo ? `/api/combos/${editingCombo._id}` : '/api/combos';
      const method = editingCombo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comboData),
      });

      if (res.ok) {
        toast.success(editingCombo ? 'Combo updated!' : 'Combo created!');
        setShowModal(false);
        setEditingCombo(null);
        resetForm();
        fetchCombos();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save combo');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredCombos = combos.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const regularPrice    = calculateRegularPrice();
  const savings         = formData.comboPrice ? regularPrice - parseFloat(formData.comboPrice) : 0;
  const discountPercent = regularPrice > 0 ? Math.round((savings / regularPrice) * 100) : 0;

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
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
            <h1 className="text-3xl font-bold text-brand-black mb-2">Combo Deals</h1>
            <p className="text-gray-600">Manage combos for {branch.displayName}</p>
            <p className="text-sm text-gray-500 mt-1">{combos.length} total combos</p>
          </div>
          <button
            onClick={() => { setEditingCombo(null); resetForm(); setShowModal(true); }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Combo</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search combos..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {filteredCombos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No combos found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Get started by adding your first combo'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="btn-primary">Add Combo</button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Combo</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Items</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Pricing</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Stock</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCombos.map((combo) => {
                    const s = combo.regularPrice - combo.comboPrice;
                    const d = Math.round((s / combo.regularPrice) * 100);
                    return (
                      <tr key={combo._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              {combo.images[0] ? (
                                <img src={combo.images[0]} alt={combo.name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <Gift className="w-6 h-6 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{combo.name}</p>
                              <p className="text-sm text-gray-600 line-clamp-1">{combo.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                            {combo.items.length} products
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-brand-orange">R{combo.comboPrice.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 line-through">R{combo.regularPrice.toFixed(2)}</p>
                          <p className="text-xs text-green-600 font-semibold">Save {d}%</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            combo.stockLevel > 10 ? 'bg-green-100 text-green-800'
                            : combo.stockLevel > 0 ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                            {combo.stockLevel} units
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${combo.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {combo.active ? 'Active' : 'Hidden'}
                            </span>
                            {combo.featured && (
                              <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-blue-100 text-blue-800">Featured</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleEdit(combo)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDelete(combo._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-5 h-5" />
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

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full my-8">
              <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-brand-black">
                    {editingCombo ? 'Edit Combo' : 'Add New Combo'}
                  </h2>
                  <button
                    onClick={() => { setShowModal(false); setEditingCombo(null); resetForm(); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Combo Name *</label>
                      <input
                        type="text" required className="input-field"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Family Braai Pack"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                      <textarea
                        required rows={3} className="input-field"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe what's included in this combo..."
                      />
                    </div>
                  </div>
                </div>

                {/* Combo Items — product picker matches specials pattern */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-brand-black">Combo Items</h3>
                    <button type="button" onClick={addComboItem} className="btn-secondary flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </div>

                  {formData.items.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-4">No products added yet</p>
                      <button type="button" onClick={addComboItem} className="btn-primary">
                        Add First Product
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.items.map((item, index) => {
                        const product  = products.find(p => p._id === item.productId);
                        const itemTotal = (product?.price || 0) * item.quantity;
                        const filterTerm = itemFilterTerms[index] || '';
                        const filtered   = products.filter(p =>
                          p.name.toLowerCase().includes(filterTerm.toLowerCase())
                        );

                        return (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Item {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeComboItem(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                              {/* ── Product picker — identical to specials bundle picker ── */}
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>

                                {/* Filter input */}
                                <input
                                  type="text"
                                  className="input-field mb-2"
                                  value={filterTerm}
                                  onChange={(e) =>
                                    setItemFilterTerms(prev => ({ ...prev, [index]: e.target.value }))
                                  }
                                  placeholder="Filter products..."
                                />

                                {/* Multi-row scrollable select */}
                                <select
                                  required
                                  className="input-field h-32 overflow-y-auto"
                                  size={6}
                                  value={item.productId}
                                  onChange={(e) => updateComboItem(index, 'productId', e.target.value)}
                                >
                                  <option value="">Select product</option>
                                  {filtered.map((p) => (
                                    <option key={p._id} value={p._id}>
                                      {p.name} - R{p.price.toFixed(2)}
                                    </option>
                                  ))}
                                </select>

                                {/* Count + Load More — identical to specials */}
                                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                  <span>{filtered.length} products shown</span>
                                  {hasMoreProducts && (
                                    <button
                                      type="button"
                                      onClick={loadMoreProducts}
                                      disabled={loadingMoreProducts}
                                      className="text-brand-orange hover:text-orange-600 font-medium"
                                    >
                                      {loadingMoreProducts ? 'Loading...' : 'Load More'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Quantity */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                                <input
                                  type="number" min="1" required className="input-field"
                                  value={item.quantity}
                                  onChange={(e) => updateComboItem(index, 'quantity', parseInt(e.target.value))}
                                />
                                {product && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Item total:{' '}
                                    <span className="font-semibold text-gray-900">R{itemTotal.toFixed(2)}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Pricing</h3>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Regular Price (Total):</span>
                      <span className="font-bold text-gray-900">R{regularPrice.toFixed(2)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">You Save:</span>
                        <span className="font-bold text-green-600">R{savings.toFixed(2)} ({discountPercent}%)</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Combo Price (R) *</label>
                    <input
                      type="number" step="0.01" required className="input-field"
                      value={formData.comboPrice}
                      onChange={(e) => setFormData({ ...formData, comboPrice: e.target.value })}
                      placeholder="Must be less than regular price"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be less than R{regularPrice.toFixed(2)}</p>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Combo Image</h3>
                  <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-orange transition-colors mb-4">
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload image'}</span>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img src={image} alt={`Combo ${index + 1}`} className="w-full h-32 object-cover rounded-xl" />
                          <button
                            type="button" onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock & Status */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Inventory & Status</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stock Level *</label>
                      <input
                        type="number" required className="input-field"
                        value={formData.stockLevel}
                        onChange={(e) => setFormData({ ...formData, stockLevel: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="w-5 h-5 text-brand-orange rounded" />
                      <div>
                        <p className="font-medium text-gray-900">Active</p>
                        <p className="text-sm text-gray-600">Combo will be visible to customers</p>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={formData.featured} onChange={(e) => setFormData({ ...formData, featured: e.target.checked })} className="w-5 h-5 text-brand-orange rounded" />
                      <div>
                        <p className="font-medium text-gray-900">Featured</p>
                        <p className="text-sm text-gray-600">Show in featured combos section</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-4 border-t sticky bottom-0 bg-white">
                  <button type="button" onClick={() => { setShowModal(false); setEditingCombo(null); resetForm(); }} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || uploading} className="btn-primary flex items-center space-x-2">
                    <Save className="w-5 h-5" />
                    <span>{saving ? 'Saving...' : editingCombo ? 'Update Combo' : 'Create Combo'}</span>
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