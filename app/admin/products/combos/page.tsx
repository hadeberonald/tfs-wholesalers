'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Save, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadMultipleToCloudinary } from '@/lib/cloudinary';

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
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
}

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    items: [] as ComboItem[],
    comboPrice: '',
    images: [] as string[],
    active: true,
    featured: false,
    stockLevel: '100',
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');

  useEffect(() => {
    fetchCombos();
    fetchProducts();
  }, []);

  const fetchCombos = async () => {
    try {
      const res = await fetch('/api/combos');
      if (res.ok) {
        const data = await res.json();
        setCombos(data.combos || []);
      }
    } catch (error) {
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?all=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to load products');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = Array.from(files).filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = Array.from(files).filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error('Images must be under 10MB');
      return;
    }

    setUploading(true);
    
    try {
      const urls = await uploadMultipleToCloudinary(Array.from(files));
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...urls]
      }));
      
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} uploaded successfully!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    toast.success('Image removed');
  };

  const calculateRegularPrice = (items: ComboItem[]) => {
    return items.reduce((total, item) => {
      const product = products.find(p => p._id === item.productId);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  const addItemToCombo = () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    const product = products.find(p => p._id === selectedProduct);
    if (!product) return;

    const existingItem = formData.items.find(i => i.productId === selectedProduct);
    
    if (existingItem) {
      toast.error('Product already in combo');
      return;
    }

    const newItem: ComboItem = {
      productId: selectedProduct,
      productName: product.name,
      quantity: parseInt(selectedQuantity),
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setSelectedProduct('');
    setSelectedQuantity('1');
    toast.success('Item added to combo');
  };

  const removeItemFromCombo = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.productId !== productId)
    }));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.productId === productId ? { ...i, quantity } : i
      )
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      items: [],
      comboPrice: '',
      images: [],
      active: true,
      featured: false,
      stockLevel: '100',
    });
    setSelectedProduct('');
    setSelectedQuantity('1');
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
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.items.length === 0) {
      toast.error('Please add at least one product to the combo');
      return;
    }

    setSaving(true);

    try {
      const regularPrice = calculateRegularPrice(formData.items);
      const comboData = {
        ...formData,
        comboPrice: parseFloat(formData.comboPrice),
        regularPrice,
        stockLevel: parseInt(formData.stockLevel),
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
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
        setShowModal(false);
        setEditingCombo(null);
        resetForm();
        fetchCombos();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save combo');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredCombos = combos.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const regularPrice = calculateRegularPrice(formData.items);
  const savings = regularPrice > 0 && formData.comboPrice 
    ? regularPrice - parseFloat(formData.comboPrice)
    : 0;
  const savingsPercent = regularPrice > 0 
    ? ((savings / regularPrice) * 100).toFixed(0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Product Combos</h1>
            <p className="text-gray-600">{combos.length} total combos</p>
          </div>
          <button
            onClick={() => {
              setEditingCombo(null);
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Combo</span>
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

        {/* Combos Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading combos...</p>
          </div>
        ) : filteredCombos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No combos found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Create your first product combo'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                Create Combo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCombos.map((combo) => (
              <div key={combo._id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                {/* Image */}
                {combo.images[0] && (
                  <div className="mb-4 rounded-xl overflow-hidden">
                    <img
                      src={combo.images[0]}
                      alt={combo.name}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{combo.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{combo.description}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      onClick={() => handleEdit(combo)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(combo._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">{combo.items.length} items in combo</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Combo Price:</span>
                    <span className="text-xl font-bold text-brand-orange">
                      R{combo.comboPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 line-through">R{combo.regularPrice.toFixed(2)}</span>
                    <span className="text-green-600 font-semibold">
                      Save R{(combo.regularPrice - combo.comboPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    combo.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {combo.active ? 'Active' : 'Hidden'}
                  </span>
                  {combo.featured && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                      Featured
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full my-8">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-brand-black">
                    {editingCombo ? 'Edit Combo' : 'Create New Combo'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingCombo(null);
                      resetForm();
                    }}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Combo Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Breakfast Combo, Party Pack"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        required
                        rows={3}
                        className="input-field"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe what's included in this combo..."
                      />
                    </div>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Combo Image</h3>
                  
                  <div className="mb-4">
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-sm text-gray-600">
                          {uploading ? 'Uploading...' : 'Click to upload combo image'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB (1 image recommended)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Combo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Products */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Combo Items</h3>
                  
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-3">Add products to this combo:</p>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <select
                          className="input-field"
                          value={selectedProduct}
                          onChange={(e) => setSelectedProduct(e.target.value)}
                        >
                          <option value="">Select a product</option>
                          {products
                            .filter(p => !formData.items.find(i => i.productId === p._id))
                            .map((product) => (
                              <option key={product._id} value={product._id}>
                                {product.name} - R{product.price.toFixed(2)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          className="input-field"
                          value={selectedQuantity}
                          onChange={(e) => setSelectedQuantity(e.target.value)}
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={addItemToCombo}
                          className="btn-primary whitespace-nowrap"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {formData.items.length > 0 ? (
                    <div className="space-y-2">
                      {formData.items.map((item) => {
                        const product = products.find(p => p._id === item.productId);
                        return (
                          <div key={item.productId} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                            <div className="flex items-center space-x-3 flex-1">
                              {product?.images[0] && (
                                <img 
                                  src={product.images[0]} 
                                  alt={item.productName}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{item.productName}</p>
                                <p className="text-sm text-gray-500">
                                  R{product?.price.toFixed(2)} each
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value))}
                                className="w-20 input-field"
                              />
                              <button
                                type="button"
                                onClick={() => removeItemFromCombo(item.productId)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No items added yet
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Pricing</h3>
                  
                  <div className="bg-blue-50 rounded-xl p-4 mb-4">
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">Regular Price:</p>
                        <p className="text-xl font-bold text-gray-900">R{regularPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Your Savings:</p>
                        <p className="text-xl font-bold text-green-600">
                          R{savings.toFixed(2)} ({savingsPercent}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Customer Pays:</p>
                        <p className="text-xl font-bold text-brand-orange">
                          R{formData.comboPrice || '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Combo Price (R) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="input-field"
                      value={formData.comboPrice}
                      onChange={(e) => setFormData({ ...formData, comboPrice: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set this lower than R{regularPrice.toFixed(2)} to offer a discount
                    </p>
                  </div>
                </div>

                {/* Stock & Status */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Stock & Status</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Level *
                      </label>
                      <input
                        type="number"
                        required
                        className="input-field"
                        value={formData.stockLevel}
                        onChange={(e) => setFormData({ ...formData, stockLevel: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="w-5 h-5 text-brand-orange rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Active</p>
                        <p className="text-sm text-gray-600">Combo will be visible to customers</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.featured}
                        onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                        className="w-5 h-5 text-brand-orange rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Featured</p>
                        <p className="text-sm text-gray-600">Show in featured combos section</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingCombo(null);
                      resetForm();
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploading || formData.items.length === 0}
                    className="btn-primary flex items-center space-x-2"
                  >
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