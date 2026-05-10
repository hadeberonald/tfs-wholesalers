'use client';

// tfs-wholesalers/app/admin/categories/page.tsx (or wherever your admin page lives)

import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  Star, Upload, X, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useBranch } from '@/lib/branch-context';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  icon?: string;   // ← dedicated nav-tile icon
  parentId?: string | null;
  level: number;
  order: number;
  active: boolean;
  featured: boolean;
  listed: boolean;
  children?: Category[];
}

interface FormData {
  name: string;
  description: string;
  image: string;
  banner: string;
  icon: string;    // ← dedicated nav-tile icon
  parentId: string | null;
  order: number;
  active: boolean;
  featured: boolean;
  listed: boolean;
}

const EMPTY_FORM: FormData = {
  name: '', description: '', image: '', banner: '', icon: '',
  parentId: null, order: 0, active: true, featured: false, listed: false,
};

export default function AdminCategoriesPage() {
  const { branch, loading: branchLoading } = useBranch();
  const [categories, setCategories]                 = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showModal, setShowModal]           = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [uploadingImage,  setUploadingImage]  = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingIcon,   setUploadingIcon]   = useState(false); // ← new
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (!branchLoading && branch) fetchCategories();
  }, [branchLoading, branch]);

  const fetchCategories = async () => {
    if (!branch) return;
    try {
      setLoading(true);
      const res = await fetch('/api/categories?all=true&withChildren=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      } else {
        toast.error('Failed to load categories');
      }
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    try {
      const url    = editingCategory ? `/api/categories/${editingCategory._id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success(editingCategory ? 'Category updated' : 'Category created');
        setShowModal(false);
        resetForm();
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save category');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name:        category.name,
      description: category.description || '',
      image:       category.image   || '',
      banner:      category.banner  || '',
      icon:        category.icon    || '',
      parentId:    category.parentId || null,
      order:       category.order   || 0,
      active:      category.active,
      featured:    category.featured || false,
      listed:      category.listed   || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete "${category.name}"?`)) return;
    try {
      const res = await fetch(`/api/categories/${category._id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Category deleted'); fetchCategories(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to delete category'); }
    } catch { toast.error('An error occurred'); }
  };

  const resetForm = () => { setFormData(EMPTY_FORM); setEditingCategory(null); };

  // Generic image uploader — handles image | banner | icon
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'banner' | 'icon'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/'))  { toast.error('Please upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024)     { toast.error('Image must be less than 5MB');  return; }

    try {
      if (field === 'image')  setUploadingImage(true);
      if (field === 'banner') setUploadingBanner(true);
      if (field === 'icon')   setUploadingIcon(true);

      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, [field]: url }));
      toast.success('Uploaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (field === 'image')  setUploadingImage(false);
      if (field === 'banner') setUploadingBanner(false);
      if (field === 'icon')   setUploadingIcon(false);
    }
  };

  const removeImage = (field: 'image' | 'banner' | 'icon') =>
    setFormData(prev => ({ ...prev, [field]: '' }));

  // ── Reusable upload block ─────────────────────────────────────────────────
  const UploadBlock = ({
    field, label, hint, uploading,
  }: {
    field: 'image' | 'banner' | 'icon';
    label: string;
    hint: string;
    uploading: boolean;
  }) => {
    const value = formData[field];
    const inputId = `upload-${field}`;
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        {value ? (
          <div className="relative">
            <img
              src={value}
              alt={label}
              className={`w-full object-cover rounded-lg ${field === 'icon' ? 'h-28' : 'h-48'}`}
            />
            <button
              type="button"
              onClick={() => removeImage(field)}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <input
              type="file" accept="image/*" id={inputId}
              onChange={e => handleImageUpload(e, field)}
              disabled={uploading} className="hidden"
            />
            <label
              htmlFor={inputId}
              className={`flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''} ${field === 'icon' ? 'h-28' : 'h-48'}`}
            >
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">{uploading ? 'Uploading…' : `Click to upload ${label.toLowerCase()}`}</span>
              <span className="text-xs text-gray-500 mt-1">{hint}</span>
            </label>
          </>
        )}
      </div>
    );
  };

  const renderCategory = (category: Category, level = 0): JSX.Element => {
    const hasChildren = !!category.children?.length;
    const isExpanded  = expandedCategories.has(category._id);
    const iconSrc     = category.icon || category.image;

    return (
      <div key={category._id}>
        <div className={`flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow ${level > 0 ? 'ml-8 mt-2' : 'mb-2'}`}>
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(category._id)} className="p-1 hover:bg-gray-100 rounded">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
              </button>
            ) : <div className="w-7" />}

            {iconSrc && (
              <img src={iconSrc} alt={category.name} className="w-12 h-12 object-cover rounded-full border-2 border-orange-100" />
            )}

            <div className="flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="font-semibold text-brand-black">{category.name}</h3>
                {category.featured && (
                  <span title="Featured in carousel">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  </span>
                )}
                {category.listed && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-brand-orange rounded-full font-medium">
                    <LayoutGrid className="w-3 h-3" />Listed
                  </span>
                )}
                {!category.active && (
                  <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">Inactive</span>
                )}
              </div>
              {category.description && <p className="text-sm text-gray-600 mt-1">{category.description}</p>}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setFormData({ ...EMPTY_FORM, parentId: category._id }); setShowModal(true); }}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add subcategory"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button onClick={() => handleEdit(category)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Edit2 className="w-5 h-5" />
            </button>
            <button onClick={() => handleDelete(category)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{category.children!.map(child => renderCategory(child, level + 1))}</div>
        )}
      </div>
    );
  };

  if (branchLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
    </div>
  );

  if (!branch) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
        <p className="text-gray-600">The requested branch could not be found.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-2">Categories</h1>
            <p className="text-gray-600">Manage your product categories for {branch.displayName}</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center space-x-2 bg-brand-orange text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" /><span>Add Category</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first category</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">Add Category</button>
          </div>
        ) : (
          <div>{categories.map(cat => renderCategory(cat))}</div>
        )}

        {/* ── Modal ──────────────────────────────────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-brand-black">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                {/* ── Icon upload (new — used in nav tiles) ── */}
                <div className="rounded-xl border-2 border-orange-100 bg-orange-50/40 p-4 space-y-2">
                  <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">
                    Nav Tile Icon
                  </p>
                  <p className="text-xs text-gray-500">
                    Shown in the compact scrollable strip on the home page. Square format works best —
                    transparent PNG or icon-style image. If left empty the category image below is used instead.
                  </p>
                  <UploadBlock
                    field="icon"
                    label="Icon Image"
                    hint="Square / icon format, e.g. 256×256px"
                    uploading={uploadingIcon}
                  />
                </div>

                {/* Category image */}
                <UploadBlock
                  field="image"
                  label="Category Image (square)"
                  hint="Used as fallback if no icon is set. Square format recommended."
                  uploading={uploadingImage}
                />

                {/* Banner image */}
                <UploadBlock
                  field="banner"
                  label="Banner Image (landscape)"
                  hint="Used in the hero carousel. Recommended: 1920×500px"
                  uploading={uploadingBanner}
                />

                {/* Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                  <input
                    type="number" value={formData.order}
                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.active}
                      onChange={e => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.featured}
                      onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Featured <span className="font-normal text-gray-500">(hero carousel)</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.listed}
                      onChange={e => setFormData({ ...formData, listed: e.target.checked })}
                      className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Listed <span className="font-normal text-gray-500">(compact nav tiles)</span>
                    </span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button" onClick={handleSubmit}
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