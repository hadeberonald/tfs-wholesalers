'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Upload, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadMultipleToCloudinary } from '@/lib/cloudinary';

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  stockLevel: number;
  lowStockThreshold: number;
  images: string[];
  onSpecial: boolean;
  specialPrice?: number;
  specialStartDate?: string;
  specialEndDate?: string;
  active: boolean;
  featured: boolean;
  unit?: string;
  weight?: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    compareAtPrice: '',
    costPrice: '',
    sku: '',
    stockLevel: '',
    lowStockThreshold: '10',
    images: [] as string[],
    onSpecial: false,
    specialPrice: '',
    specialStartDate: '',
    specialEndDate: '',
    active: true,
    featured: false,
    unit: '',
    weight: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?all=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      toast.error('Failed to load products');
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      compareAtPrice: '',
      costPrice: '',
      sku: '',
      stockLevel: '',
      lowStockThreshold: '10',
      images: [],
      onSpecial: false,
      specialPrice: '',
      specialStartDate: '',
      specialEndDate: '',
      active: true,
      featured: false,
      unit: '',
      weight: '',
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price.toString(),
      compareAtPrice: product.compareAtPrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      sku: product.sku,
      stockLevel: product.stockLevel.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
      images: product.images,
      onSpecial: product.onSpecial,
      specialPrice: product.specialPrice?.toString() || '',
      specialStartDate: product.specialStartDate || '',
      specialEndDate: product.specialEndDate || '',
      active: product.active,
      featured: product.featured,
      unit: product.unit || '',
      weight: product.weight?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product deleted');
        fetchProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
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
      };

      const url = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        toast.success(editingProduct ? 'Product updated!' : 'Product created!');
        setShowModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save product');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Products</h1>
            <p className="text-gray-600">{products.length} total products</p>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Get started by adding your first product'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">SKU</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Stock</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {/* REDUCED SIZE: Changed from w-12 h-12 to w-8 h-8 */}
                          <div className="w-8 h-8 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {product.images[0] ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                No img
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500 capitalize">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            R{(product.specialPrice || product.price).toFixed(2)}
                          </p>
                          {product.specialPrice && (
                            <p className="text-xs text-red-600">On Special</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.stockLevel > product.lowStockThreshold
                            ? 'bg-green-100 text-green-800'
                            : product.stockLevel > 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.stockLevel} units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${
                            product.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.active ? 'Active' : 'Hidden'}
                          </span>
                          {product.featured && (
                            <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-blue-100 text-blue-800">
                              Featured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(product._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
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

        {/* MODAL - Same as before but included for completeness */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full my-8">
              <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-brand-black">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
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
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        required
                        rows={3}
                        className="input-field"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        required
                        className="input-field"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="">Select category</option>
                        {categories.map((cat: any) => (
                          <option key={cat._id} value={cat.slug}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SKU *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Pricing</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (R) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="input-field"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Compare at Price (R)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={formData.compareAtPrice}
                        onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Price (R)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Special Pricing */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-brand-black">Special Pricing</h3>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.onSpecial}
                        onChange={(e) => setFormData({ ...formData, onSpecial: e.target.checked })}
                        className="w-5 h-5 text-brand-orange rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">On Special</span>
                    </label>
                  </div>

                  {formData.onSpecial && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Special Price (R) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required={formData.onSpecial}
                          className="input-field"
                          value={formData.specialPrice}
                          onChange={(e) => setFormData({ ...formData, specialPrice: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          className="input-field"
                          value={formData.specialStartDate}
                          onChange={(e) => setFormData({ ...formData, specialStartDate: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          className="input-field"
                          value={formData.specialEndDate}
                          onChange={(e) => setFormData({ ...formData, specialEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Inventory */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Inventory</h3>
                  <div className="grid md:grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Low Stock Threshold *
                      </label>
                      <input
                        type="number"
                        required
                        className="input-field"
                        value={formData.lowStockThreshold}
                        onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Product Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="bag, bottle, box, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Product Images</h3>
                  
                  <div className="mb-4">
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-sm text-gray-600">
                          {uploading ? 'Uploading...' : 'Click to upload images'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                      </div>
                      <input
                        type="file"
                        multiple
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
                            alt={`Product ${index + 1}`}
                            className="w-full h-32 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {index === 0 && (
                            <span className="absolute bottom-2 left-2 bg-brand-orange text-white text-xs px-2 py-1 rounded">
                              Main
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Status</h3>
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
                        <p className="text-sm text-gray-600">Product will be visible to customers</p>
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
                        <p className="text-sm text-gray-600">Show in featured products section</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-4 border-t sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploading}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-5 h-5" />
                    <span>{saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}</span>
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