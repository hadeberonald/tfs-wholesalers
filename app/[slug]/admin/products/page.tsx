'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit, Trash2, Package, Search, Save, X, Upload, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';
import { uploadMultipleToCloudinary } from '@/lib/cloudinary';

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
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  categories: string[];
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
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  children?: Category[];
}

export default function AdminProductsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categories: [] as string[],
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
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchProducts();
      fetchCategories();
    }
  }, [branchLoading, branch, currentPage, itemsPerPage]);

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
        console.log(`✅ Loaded page ${currentPage}: ${data.products?.length || 0} products (${data.total} total)`);
      } else {
        toast.error('Failed to load products');
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?all=true&withChildren=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantIndex?: number) => {
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
      
      if (variantIndex !== undefined) {
        setFormData(prev => ({
          ...prev,
          variants: prev.variants.map((v, i) => 
            i === variantIndex 
              ? { ...v, images: [...v.images, ...urls] }
              : v
          )
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...urls]
        }));
      }
      
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} uploaded successfully!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number, variantIndex?: number) => {
    if (variantIndex !== undefined) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.map((v, i) => 
          i === variantIndex 
            ? { ...v, images: v.images.filter((_, idx) => idx !== index) }
            : v
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    }
    toast.success('Image removed');
  };

  const addVariant = () => {
    const newVariant: ProductVariant = {
      name: '',
      sku: '',
      barcode: '',
      stockLevel: 0,
      images: [],
      active: true,
    };
    
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant]
    }));
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
    toast.success('Variant removed');
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => 
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  const toggleVariantExpanded = (index: number) => {
    setExpandedVariants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categories: [],
      price: '',
      compareAtPrice: '',
      costPrice: '',
      sku: '',
      barcode: '',
      stockLevel: '',
      lowStockThreshold: '10',
      images: [],
      hasVariants: false,
      variants: [],
      onSpecial: false,
      specialPrice: '',
      specialStartDate: '',
      specialEndDate: '',
      active: true,
      featured: false,
      unit: '',
      weight: '',
    });
    setExpandedVariants(new Set());
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      categories: product.categories || [],
      price: product.price.toString(),
      compareAtPrice: product.compareAtPrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      sku: product.sku,
      barcode: product.barcode || '',
      stockLevel: product.stockLevel.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
      images: product.images,
      hasVariants: product.hasVariants || false,
      variants: product.variants || [],
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
        const data = await res.json();
        toast.error(data.error || 'Failed to delete product');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleCategoryToggle = (categorySlug: string) => {
    setFormData(prev => {
      const categories = prev.categories.includes(categorySlug)
        ? prev.categories.filter(c => c !== categorySlug)
        : [...prev.categories, categorySlug];
      return { ...prev, categories };
    });
  };

  const renderCategoryCheckboxes = (cats: Category[], level = 0): JSX.Element[] => {
    return cats.flatMap(cat => [
      <label key={cat._id} className={`flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded ${level > 0 ? 'ml-' + (level * 4) : ''}`}>
        <input
          type="checkbox"
          checked={formData.categories.includes(cat.slug)}
          onChange={() => handleCategoryToggle(cat.slug)}
          className="w-4 h-4 text-brand-orange rounded"
        />
        <span className="text-sm text-gray-700">{cat.name}</span>
      </label>,
      ...(cat.children && cat.children.length > 0 ? renderCategoryCheckboxes(cat.children, level + 1) : [])
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (formData.categories.length === 0) {
        toast.error('Please select at least one category');
        setSaving(false);
        return;
      }

      if (formData.hasVariants) {
        if (formData.variants.length === 0) {
          toast.error('Please add at least one variant or disable variants');
          setSaving(false);
          return;
        }

        for (let i = 0; i < formData.variants.length; i++) {
          const variant = formData.variants[i];
          if (!variant.name || !variant.sku || variant.stockLevel === undefined) {
            toast.error(`Variant ${i + 1}: Name, SKU, and Stock Level are required`);
            setSaving(false);
            return;
          }
        }
      }

      const productData = {
        ...formData,
        categories: formData.categories,
        price: parseFloat(formData.price),
        compareAtPrice: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : undefined,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        stockLevel: parseInt(formData.stockLevel),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
        specialPrice: formData.specialPrice ? parseFloat(formData.specialPrice) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        variants: formData.hasVariants ? formData.variants.map(v => ({
          ...v,
          price: v.price ? parseFloat(v.price as any) : undefined,
          compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice as any) : undefined,
          specialPrice: v.specialPrice ? parseFloat(v.specialPrice as any) : undefined,
        })) : undefined,
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

  const getTotalStock = (product: Product) => {
    if (product.hasVariants && product.variants) {
      return product.variants.reduce((sum, v) => sum + v.stockLevel, 0);
    }
    return product.stockLevel;
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
            <h1 className="text-3xl font-bold text-brand-black mb-2">Products</h1>
            <p className="text-gray-600">Manage products for {branch.displayName}</p>
            <p className="text-sm text-gray-500 mt-1">{totalProducts} total products</p>
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

        {/* Search and Pagination Controls */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
              className="input-field py-2 px-3"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
        </div>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
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
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">SKU</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Categories</th>
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
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
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
                              {product.hasVariants && product.variants && (
                                <p className="text-xs text-gray-500">{product.variants.length} variants</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {product.categories && product.categories.length > 0 ? (
                              product.categories.slice(0, 2).map((cat, i) => (
                                <span key={i} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">No categories</span>
                            )}
                            {product.categories && product.categories.length > 2 && (
                              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                +{product.categories.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
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
                            getTotalStock(product) > product.lowStockThreshold
                              ? 'bg-green-100 text-green-800'
                              : getTotalStock(product) > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {getTotalStock(product)} units
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts} products
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 rounded-lg border ${
                            currentPage === pageNum
                              ? 'bg-brand-orange text-white border-brand-orange'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full my-8">
              <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
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

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categories * (select one or more)
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                        {categories.length > 0 ? (
                          renderCategoryCheckboxes(categories)
                        ) : (
                          <p className="text-sm text-gray-500">No categories available</p>
                        )}
                      </div>
                      {formData.categories.length > 0 && (
                        <p className="text-xs text-gray-600 mt-2">
                          Selected: {formData.categories.join(', ')}
                        </p>
                      )}
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Barcode
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Variant Toggle */}
                <div className="border-t pt-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasVariants}
                      onChange={(e) => setFormData({ ...formData, hasVariants: e.target.checked })}
                      className="w-5 h-5 text-brand-orange rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">This product has variants</p>
                      <p className="text-sm text-gray-600">e.g., different flavors, sizes, or colors</p>
                    </div>
                  </label>
                </div>

                {/* Variants Section */}
                {formData.hasVariants && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-brand-black">Product Variants</h3>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Variant</span>
                      </button>
                    </div>

                    {formData.variants.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-4">No variants added yet</p>
                        <button
                          type="button"
                          onClick={addVariant}
                          className="btn-primary"
                        >
                          Add First Variant
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {formData.variants.map((variant, index) => (
                          <div key={index} className="border border-gray-300 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <button
                                type="button"
                                onClick={() => toggleVariantExpanded(index)}
                                className="flex items-center space-x-2 font-medium text-gray-900"
                              >
                                {expandedVariants.has(index) ? (
                                  <ChevronUp className="w-5 h-5" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                                <span>Variant {index + 1}: {variant.name || 'Unnamed'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeVariant(index)}
                                className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {expandedVariants.has(index) && (
                              <div className="space-y-4 pt-3 border-t">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Variant Name *
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      className="input-field"
                                      value={variant.name}
                                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                                      placeholder="e.g., Apple, Large"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      SKU *
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      className="input-field"
                                      value={variant.sku}
                                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Barcode
                                    </label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={variant.barcode || ''}
                                      onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Stock Level *
                                    </label>
                                    <input
                                      type="number"
                                      required
                                      className="input-field"
                                      value={variant.stockLevel}
                                      onChange={(e) => updateVariant(index, 'stockLevel', parseInt(e.target.value) || 0)}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Price Override (R)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="input-field"
                                      value={variant.price || ''}
                                      onChange={(e) => updateVariant(index, 'price', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      placeholder="Leave empty to use base price"
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
                                      value={variant.compareAtPrice || ''}
                                      onChange={(e) => updateVariant(index, 'compareAtPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    />
                                  </div>
                                </div>

                                {/* Variant Images */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Variant Images
                                  </label>
                                  <div className="mb-3">
                                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors">
                                      <div className="text-center">
                                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                        <span className="text-xs text-gray-600">
                                          {uploading ? 'Uploading...' : 'Upload images'}
                                        </span>
                                      </div>
                                      <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleImageUpload(e, index)}
                                        disabled={uploading}
                                      />
                                    </label>
                                  </div>

                                  {variant.images.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                      {variant.images.map((image, imgIndex) => (
                                        <div key={imgIndex} className="relative group">
                                          <img
                                            src={image}
                                            alt={`Variant ${index + 1} - ${imgIndex + 1}`}
                                            className="w-full h-20 object-cover rounded-lg"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => removeImage(imgIndex, index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={variant.active}
                                    onChange={(e) => updateVariant(index, 'active', e.target.checked)}
                                    className="w-4 h-4 text-brand-orange rounded"
                                  />
                                  <span className="text-sm font-medium text-gray-700">Variant Active</span>
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Base Product Pricing - Only when no variants */}
                {!formData.hasVariants && (
                  <>
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
                  </>
                )}

                {/* Base product pricing for variants */}
                {formData.hasVariants && (
                  <div>
                    <h3 className="text-lg font-semibold text-brand-black mb-2">Base Product Pricing</h3>
                    <p className="text-sm text-gray-600 mb-4">These values are used as defaults for variants that don't override them</p>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Base Price (R) *
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
                          Stock Level (Base) *
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
                )}

                {/* Details */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">Product Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit of Measurement
                      </label>
                      <select
                        className="input-field"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      >
                        <option value="">Select unit...</option>
                        <option value="g">Grams (g)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="ml">Milliliters (ml)</option>
                        <option value="L">Liters (L)</option>
                        <option value="ea">Each (ea)</option>
                        <option value="pack">Pack</option>
                        <option value="bag">Bag</option>
                        <option value="bottle">Bottle</option>
                        <option value="box">Box</option>
                        <option value="can">Can</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity/Size
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        placeholder="e.g., 500, 1.5, 2"
                      />
                      {formData.unit && formData.weight && (
                        <p className="text-xs text-gray-500 mt-1">
                          Display: {formData.weight}{formData.unit}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Base Product Images */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-black mb-4">
                    {formData.hasVariants ? 'Default Product Images' : 'Product Images'}
                  </h3>
                  {formData.hasVariants && (
                    <p className="text-sm text-gray-600 mb-3">These images are used when no variant is selected or as fallback</p>
                  )}
                  
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
                        onChange={(e) => handleImageUpload(e)}
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