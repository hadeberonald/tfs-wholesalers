'use client'
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Star, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  parentId?: string | null;
  level: number;
  order: number;
  active: boolean;
  featured: boolean;
  children?: Category[];
}

interface FormData {
  name: string;
  description: string;
  image: string;
  banner: string;
  parentId: string | null;
  order: number;
  active: boolean;
  featured: boolean;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    image: '',
    banner: '',
    parentId: null,
    order: 0,
    active: true,
    featured: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?all=true&withChildren=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }
    
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory._id}`
        : '/api/categories';
      
      const method = editingCategory ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(editingCategory ? 'Category updated' : 'Category created');
        setShowModal(false);
        resetForm();
        fetchCategories();
      } else {
        toast.error('Failed to save category');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      banner: category.banner || '',
      parentId: category.parentId || null,
      order: category.order || 0,
      active: category.active,
      featured: category.featured || false
    });
    setShowModal(true);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete "${category.name}"?`)) return;

    try {
      const res = await fetch(`/api/categories/${category._id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Category deleted');
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete category');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      banner: '',
      parentId: null,
      order: 0,
      active: true,
      featured: false
    });
    setEditingCategory(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      if (type === 'image') {
        setUploadingImage(true);
      } else {
        setUploadingBanner(true);
      }

      const url = await uploadToCloudinary(file);
      
      setFormData(prev => ({
        ...prev,
        [type]: url
      }));

      toast.success(`${type === 'image' ? 'Image' : 'Banner'} uploaded successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      if (type === 'image') {
        setUploadingImage(false);
      } else {
        setUploadingBanner(false);
      }
    }
  };

  const removeImage = (type: 'image' | 'banner') => {
    setFormData(prev => ({
      ...prev,
      [type]: ''
    }));
  };

  const handleSeedCategories = async () => {
    if (!confirm('This will delete all existing categories and create new ones. Continue?')) {
      return;
    }

    setSeeding(true);
    try {
      const res = await fetch('/api/admin/seed-categories', {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchCategories();
      } else {
        toast.error('Failed to seed categories');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSeeding(false);
    }
  };

  const renderCategory = (category: Category, level: number = 0): JSX.Element => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category._id);

    return (
      <div key={category._id}>
        <div
          className={`flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow ${
            level > 0 ? 'ml-8 mt-2' : 'mb-2'
          }`}
        >
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(category._id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
              </button>
            )}
            
            {!hasChildren && <div className="w-7" />}
            
            {category.image && (
              <img
                src={category.image}
                alt={category.name}
                className="w-12 h-12 object-cover rounded-lg"
              />
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-brand-black">{category.name}</h3>
                {category.featured && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
                {!category.active && (
                  <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
              </div>
              {category.description && (
                <p className="text-sm text-gray-600 mt-1">{category.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setFormData({
                  ...formData,
                  parentId: category._id
                });
                setShowModal(true);
              }}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Add subcategory"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleEdit(category)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(category)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-2">Categories</h1>
            <p className="text-gray-600">Manage your product categories and hierarchy</p>
          </div>
          <div className="flex space-x-3">
            {categories.length === 0 && (
              <button
                onClick={handleSeedCategories}
                disabled={seeding}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                <span>{seeding ? 'Seeding...' : 'Seed Categories'}</span>
              </button>
            )}
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 bg-brand-orange text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        <div>
          {categories.map(category => renderCategory(category))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-brand-black">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Image (Square)
                  </label>
                  
                  {formData.image ? (
                    <div className="relative">
                      <img
                        src={formData.image}
                        alt="Category"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage('image')}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'image')}
                        disabled={uploadingImage}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors ${
                          uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">
                          {uploadingImage ? 'Uploading...' : 'Click to upload image'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          Recommended: Square format (e.g., 800x800px)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image (Landscape)
                  </label>
                  
                  {formData.banner ? (
                    <div className="relative">
                      <img
                        src={formData.banner}
                        alt="Banner"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage('banner')}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'banner')}
                        disabled={uploadingBanner}
                        className="hidden"
                        id="banner-upload"
                      />
                      <label
                        htmlFor="banner-upload"
                        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors ${
                          uploadingBanner ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">
                          {uploadingBanner ? 'Uploading...' : 'Click to upload banner'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          Recommended: Landscape format (e.g., 1920x500px)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Featured (show in carousel)</span>
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    {editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}