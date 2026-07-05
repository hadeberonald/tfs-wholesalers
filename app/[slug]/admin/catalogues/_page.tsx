'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, X, Upload, FileText, ImageIcon,
  Download, Calendar, Clock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useBranch } from '@/lib/branch-context';

interface Catalogue {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  expiryDate: string;
  active: boolean;
  uploadedAt: string;
}

interface FormData {
  title: string;
  description: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | '';
  expiryDate: string;
  active: boolean;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  fileUrl: '',
  fileType: '',
  expiryDate: '',
  active: true,
};

function toDateInputValue(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

interface ExpiryStatus {
  label: string;
  color: string;
}

function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const diffMs = new Date(expiryDate).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { label: 'Expired', color: 'bg-red-100 text-red-700' };
  }
  if (diffDays === 0) {
    return { label: 'Expires today', color: 'bg-amber-100 text-amber-700' };
  }
  if (diffDays <= 3) {
    return { label: 'Expires in ' + diffDays + 'd', color: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'Expires in ' + diffDays + 'd', color: 'bg-green-100 text-green-700' };
}

function isDateInPast(dateStr: string): boolean {
  if (!dateStr) {
    return false;
  }
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return target < now;
}

export default function AdminCataloguesPage() {
  const { branch, loading: branchLoading } = useBranch();
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Catalogue | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchCatalogues();
    }
  }, [branchLoading, branch]);

  async function fetchCatalogues() {
    try {
      setLoading(true);
      const res = await fetch('/api/catalogues?all=true');
      if (res.ok) {
        const data = await res.json();
        setCatalogues(data.catalogues || []);
      } else {
        toast.error('Failed to load catalogues');
      }
    } catch (e) {
      toast.error('Failed to load catalogues');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData(EMPTY_FORM);
    setEditing(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) {
      return;
    }

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      toast.error('Please upload a PDF or image file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be less than 20MB');
      return;
    }

    try {
      setUploading(true);
      const url = await uploadToCloudinary(file, 'auto');
      setFormData(function (prev) {
        return { ...prev, fileUrl: url, fileType: isPdf ? 'pdf' : 'image' };
      });
      toast.success('File uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }
    if (!formData.fileUrl) {
      toast.error('Please upload a file');
      return;
    }
    if (!formData.expiryDate) {
      toast.error('Expiry date is required');
      return;
    }

    try {
      const url = editing ? '/api/catalogues/' + editing._id : '/api/catalogues';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success(editing ? 'Catalogue updated' : 'Catalogue uploaded');
        setShowModal(false);
        resetForm();
        fetchCatalogues();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save catalogue');
      }
    } catch (e) {
      toast.error('An error occurred');
    }
  }

  function handleEdit(cat: Catalogue) {
    setEditing(cat);
    setFormData({
      title: cat.title,
      description: cat.description || '',
      fileUrl: cat.fileUrl,
      fileType: cat.fileType,
      expiryDate: cat.expiryDate.split('T')[0],
      active: cat.active,
    });
    setShowModal(true);
  }

  async function handleDelete(cat: Catalogue) {
    const ok = confirm('Delete "' + cat.title + '"?');
    if (!ok) {
      return;
    }
    try {
      const res = await fetch('/api/catalogues/' + cat._id, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Catalogue deleted');
        fetchCatalogues();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to delete catalogue');
      }
    } catch (e) {
      toast.error('An error occurred');
    }
  }

  const formExpiryIsPast = isDateInPast(formData.expiryDate);

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-2">Catalogues</h1>
            <p className="text-gray-600">
              Upload catalogues for {branch ? branch.displayName : ''}. They auto-expire on their set date.
            </p>
          </div>
          <button
            onClick={function () { resetForm(); setShowModal(true); }}
            className="flex items-center space-x-2 bg-brand-orange text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Upload Catalogue</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
          </div>
        ) : catalogues.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No catalogues found</h3>
            <p className="text-gray-600 mb-6">Upload your first catalogue to get started</p>
            <button onClick={function () { setShowModal(true); }} className="btn-primary">
              Upload Catalogue
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalogues.map(function (cat) {
              const status = getExpiryStatus(cat.expiryDate);
              return (
                <div key={cat._id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="h-36 bg-gray-100 flex items-center justify-center">
                    {cat.fileType === 'image' ? (
                      <img src={cat.fileUrl} alt={cat.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-brand-black flex-1">{cat.title}</h3>
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ' + status.color}>
                        {status.label}
                      </span>
                    </div>
                    {cat.description ? (
                      <p className="text-sm text-gray-600 mb-3">{cat.description}</p>
                    ) : null}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Expires {new Date(cat.expiryDate).toLocaleDateString()}</span>
                      {!cat.active ? (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded">Inactive</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={cat.fileUrl} target="_blank" rel="noopener noreferrer" download className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                      <button onClick={function () { handleEdit(cat); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={function () { handleDelete(cat); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-brand-black">
                  {editing ? 'Edit Catalogue' : 'Upload Catalogue'}
                </h2>
                <button onClick={function () { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={function (e) { setFormData({ ...formData, title: e.target.value }); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    placeholder="e.g. July Wholesale Catalogue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    rows={2}
                    onChange={function (e) { setFormData({ ...formData, description: e.target.value }); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">File (PDF or image) *</label>
                  {formData.fileUrl ? (
                    <div className="relative border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                      {formData.fileType === 'image' ? (
                        <ImageIcon className="w-8 h-8 text-brand-orange shrink-0" />
                      ) : (
                        <FileText className="w-8 h-8 text-brand-orange shrink-0" />
                      )}
                      <a href={formData.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 truncate hover:underline">
                        {formData.fileUrl}
                      </a>
                      <button
                        type="button"
                        onClick={function () { setFormData({ ...formData, fileUrl: '', fileType: '' }); }}
                        className="ml-auto p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="catalogue-file"
                        accept="application/pdf,image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <label
                        htmlFor="catalogue-file"
                        className={'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors' + (uploading ? ' opacity-50 cursor-not-allowed' : '')}
                      >
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload PDF or image'}</span>
                        <span className="text-xs text-gray-500 mt-1">PDF or PNG/JPG, up to 20MB</span>
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Expiry date *</span>
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={function (e) { setFormData({ ...formData, expiryDate: e.target.value }); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                  />
                  <div className="flex gap-2 mt-2">
                    {[7, 14, 30, 60].map(function (days) {
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={function () { setFormData({ ...formData, expiryDate: toDateInputValue(days) }); }}
                          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-orange-100 hover:text-brand-orange rounded-full transition-colors"
                        >
                          {days} days
                        </button>
                      );
                    })}
                  </div>
                  {editing && formExpiryIsPast ? (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>This catalogue is currently expired and hidden from customers.</span>
                    </p>
                  ) : null}
                </div>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={function (e) { setFormData({ ...formData, active: e.target.checked }); }}
                    className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={function () { setShowModal(false); resetForm(); }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    {editing ? 'Update' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}