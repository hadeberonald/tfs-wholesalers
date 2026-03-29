'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, MoveUp, MoveDown, Eye, EyeOff, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useBranch } from '@/lib/branch-context';

interface HeroBanner {
  _id: string;
  title: string;
  subtitle: string;
  image: string;
  imageMobile?: string;
  link: string;
  buttonText: string;
  showOverlay?: boolean;
  active: boolean;
  order: number;
}

export default function HeroBannersPage() {
  const { branch, loading: branchLoading } = useBranch();

  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image: '',
    imageMobile: '',
    link: '',
    buttonText: '',
    showOverlay: true,
    active: true,
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchBanners();
    }
  }, [branchLoading, branch]);

  const fetchBanners = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/admin/hero-banners?branchId=${branch.id}`);
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners || []);
      } else {
        toast.error('Failed to load banners');
      }
    } catch {
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'imageMobile'
  ) => {
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

    field === 'image' ? setUploadingDesktop(true) : setUploadingMobile(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, [field]: url }));
      toast.success('Image uploaded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      field === 'image' ? setUploadingDesktop(false) : setUploadingMobile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    setSaving(true);

    try {
      const url = editingBanner
        ? `/api/admin/hero-banners/${editingBanner._id}`
        : '/api/admin/hero-banners';

      const res = await fetch(url, {
        method: editingBanner ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          branchId: branch.id,                                          // always sent
          order: editingBanner ? editingBanner.order : banners.length + 1,
        }),
      });

      if (res.ok) {
        toast.success(editingBanner ? 'Banner updated!' : 'Banner created!');
        closeModal();
        fetchBanners();
      } else {
        toast.error('Failed to save banner');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setFormData({ title: '', subtitle: '', image: '', imageMobile: '', link: '', buttonText: '', showOverlay: true, active: true });
  };

  const handleEdit = (banner: HeroBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle,
      image: banner.image,
      imageMobile: banner.imageMobile || '',
      link: banner.link,
      buttonText: banner.buttonText,
      showOverlay: banner.showOverlay !== false,
      active: banner.active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!branch || !confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await fetch(`/api/admin/hero-banners/${id}?branchId=${branch.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Banner deleted');
        fetchBanners();
      } else {
        toast.error('Failed to delete banner');
      }
    } catch {
      toast.error('Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner: HeroBanner) => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/admin/hero-banners/${banner._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...banner, branchId: branch.id, active: !banner.active }),
      });
      if (res.ok) {
        toast.success(banner.active ? 'Banner hidden' : 'Banner activated');
        fetchBanners();
      } else {
        toast.error('Failed to update banner');
      }
    } catch {
      toast.error('Failed to update banner');
    }
  };

  const moveOrder = async (banner: HeroBanner, direction: 'up' | 'down') => {
    if (!branch) return;
    const currentIndex = banners.findIndex(b => b._id === banner._id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= banners.length) return;

    const newBanners = [...banners];
    [newBanners[currentIndex], newBanners[newIndex]] = [newBanners[newIndex], newBanners[currentIndex]];

    try {
      const res = await fetch('/api/admin/hero-banners/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branch.id,
          updates: newBanners.map((b, i) => ({ id: b._id, order: i + 1 })),
        }),
      });
      if (res.ok) {
        toast.success('Order updated');
        fetchBanners();
      } else {
        toast.error('Failed to update order');
      }
    } catch {
      toast.error('Failed to update order');
    }
  };

  // ─── Reusable upload field ───────────────────────────────────────────────────
  const ImageUploadField = ({
    label,
    hint,
    field,
    uploading,
  }: {
    label: string;
    hint: string;
    field: 'image' | 'imageMobile';
    uploading: boolean;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {formData[field] ? (
        <div className="relative mb-1">
          <img src={formData[field]} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, [field]: '' }))}
            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-orange transition-colors">
          <div className="text-center">
            <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
            <span className="text-sm text-gray-600">
              {uploading ? 'Uploading...' : `Click to upload ${label.toLowerCase()}`}
            </span>
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, field)}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );

  // ─── Guards ──────────────────────────────────────────────────────────────────
  if (branchLoading || loading) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
        <p className="text-gray-600">Loading banners...</p>
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

  // ─── Main UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Hero Banners</h1>
            <p className="text-gray-600">Manage homepage slider banners for {branch.displayName}</p>
            <p className="text-sm text-gray-500 mt-2">
              Desktop: 1920 × 800px (16:5) &nbsp;·&nbsp; Mobile: 900 × 1200px (portrait)
            </p>
          </div>
          <button
            onClick={() => { closeModal(); setShowModal(true); }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Banner</span>
          </button>
        </div>

        {banners.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No banners yet</h3>
            <p className="text-gray-600 mb-6">Create your first hero banner to display on the homepage</p>
            <button onClick={() => setShowModal(true)} className="btn-primary inline-block">
              Add Banner
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {banners.map((banner, index) => (
              <div
                key={banner._id}
                className="bg-white rounded-2xl p-6 flex items-center space-x-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Thumbnails */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="relative w-40 h-20 rounded-xl overflow-hidden bg-gray-100">
                    <img src={banner.image} alt="Desktop" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">
                      Desktop
                    </span>
                    {!banner.active && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <EyeOff className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  {banner.imageMobile ? (
                    <div className="relative w-14 h-20 rounded-xl overflow-hidden bg-gray-100">
                      <img src={banner.imageMobile} alt="Mobile" className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] bg-black/50 text-white">
                        Mobile
                      </span>
                    </div>
                  ) : (
                    <div className="w-14 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                      <span className="text-[9px] text-gray-400 text-center leading-tight px-1">No mobile img</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-brand-black">{banner.title}</h3>
                      <p className="text-gray-600 text-sm">{banner.subtitle}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className="text-xs text-gray-500">Order: {banner.order}</span>
                        <span className={`text-xs px-2 py-1 rounded ${banner.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {banner.active ? 'Active' : 'Hidden'}
                        </span>
                        {!banner.imageMobile && (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                            No mobile image
                          </span>
                        )}
                        {!banner.showOverlay && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                            No Overlay
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => moveOrder(banner, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveOrder(banner, 'down')}
                          disabled={index === banners.length - 1}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>
                      </div>
                      <button onClick={() => handleToggleActive(banner)} className="p-2 hover:bg-gray-100 rounded-lg">
                        {banner.active
                          ? <Eye className="w-5 h-5 text-green-600" />
                          : <EyeOff className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button onClick={() => handleEdit(banner)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(banner._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Modal ── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-brand-black">
                  {editingBanner ? 'Edit Banner' : 'Add New Banner'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Wholesale Excellence"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="e.g., Quality products at unbeatable prices"
                  />
                </div>

                <ImageUploadField
                  label="Desktop Image *"
                  hint="Recommended: 1920 × 800px (16:5 landscape)"
                  field="image"
                  uploading={uploadingDesktop}
                />

                <ImageUploadField
                  label="Mobile Image"
                  hint="Recommended: 900 × 1200px portrait — falls back to desktop image if not set"
                  field="imageMobile"
                  uploading={uploadingMobile}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Link URL</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    placeholder="/products or https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.buttonText}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    placeholder="e.g., Shop Now"
                  />
                </div>

                <div className="border-t pt-4 space-y-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showOverlay}
                      onChange={(e) => setFormData({ ...formData, showOverlay: e.target.checked })}
                      className="w-5 h-5 text-brand-orange rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Show Text Overlay</p>
                      <p className="text-sm text-gray-600">Display title, subtitle, and button on banner</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-5 h-5 text-brand-orange rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Active</p>
                      <p className="text-sm text-gray-600">Banner will be visible on homepage</p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-4 pt-4">
                  <button type="button" onClick={closeModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploadingDesktop || uploadingMobile || !formData.image}
                    className="btn-primary"
                  >
                    {saving ? 'Saving...' : editingBanner ? 'Update' : 'Create'}
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