'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Truck, MapPin, Mail,
  User, Lock, Eye, EyeOff, Upload, Store,
  Loader2, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BranchData {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  logoUrl?: string;
  settings: {
    storeLocation: { lat: number; lng: number; address: string };
    contactEmail: string;
    contactPhone: string;
    deliveryPricing: {
      local: number; localRadius: number;
      medium: number; mediumRadius: number;
      far: number; farRadius: number;
    };
    minimumOrderValue: number;
  };
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export default function EditBranchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'delivery' | 'admin'>('info');

  const [branch, setBranch] = useState<BranchData | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayName: '',
    status: 'active' as BranchData['status'],
    contactEmail: '',
    contactPhone: '',
    storeLocation: { lat: -29.8587, lng: 31.0218, address: '' },
    deliveryPricing: {
      local: 35, localRadius: 20,
      medium: 85, mediumRadius: 40,
      far: 105, farRadius: 60,
    },
    minimumOrderValue: 0,
  });

  const [adminForm, setAdminForm] = useState({
    name: '', email: '', newPassword: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [branchRes, adminRes] = await Promise.all([
          fetch(`/api/super-admin/branches/${params.id}`),
          fetch(`/api/super-admin/branches/${params.id}/admin`),
        ]);

        if (!branchRes.ok) throw new Error('Branch not found');
        const { branch: b } = await branchRes.json();
        setBranch(b);
        setLogoPreview(b.logoUrl || null);
        setFormData({
          name: b.name,
          slug: b.slug,
          displayName: b.displayName,
          status: b.status,
          contactEmail: b.settings?.contactEmail || '',
          contactPhone: b.settings?.contactPhone || '',
          storeLocation: b.settings?.storeLocation || { lat: -29.8587, lng: 31.0218, address: '' },
          deliveryPricing: b.settings?.deliveryPricing || {
            local: 35, localRadius: 20,
            medium: 85, mediumRadius: 40,
            far: 105, farRadius: 60,
          },
          minimumOrderValue: b.settings?.minimumOrderValue || 0,
        });

        if (adminRes.ok) {
          const { admin } = await adminRes.json();
          if (admin) {
            setAdminUser(admin);
            setAdminForm(prev => ({ ...prev, name: admin.name, email: admin.email }));
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/branches/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          displayName: formData.displayName,
          status: formData.status,
          ...(logoPreview !== branch?.logoUrl ? { logoUrl: logoPreview } : {}),
          settings: {
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
            storeLocation: formData.storeLocation,
            deliveryPricing: formData.deliveryPricing,
            minimumOrderValue: formData.minimumOrderValue,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Branch updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdmin = async () => {
    if (adminForm.newPassword && adminForm.newPassword !== adminForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (adminForm.newPassword && adminForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSavingAdmin(true);
    try {
      const res = await fetch(`/api/super-admin/branches/${params.id}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminForm.name,
          email: adminForm.email,
          ...(adminForm.newPassword ? { password: adminForm.newPassword } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update admin');
      }
      toast.success('Admin credentials updated');
      setAdminForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('branchId', params.id);
      const res = await fetch('/api/super-admin/upload-logo', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setLogoPreview(url);
      toast.success('Logo uploaded');
    } catch {
      // Fallback to local preview; saved on next handleSave
      const reader = new FileReader();
      reader.onload = ev => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      toast.success('Logo ready — save branch to apply');
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateDelivery = (key: string, value: number) =>
    setFormData(p => ({ ...p, deliveryPricing: { ...p.deliveryPricing, [key]: value } }));

  const tabs = [
    { id: 'info',     label: 'Branch Info',         icon: Store },
    { id: 'delivery', label: 'Location & Delivery',  icon: Truck },
    { id: 'admin',    label: 'Admin Credentials',    icon: User  },
  ] as const;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-brand-orange animate-spin mx-auto mb-3" />
        <p className="text-gray-500">Loading branch...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/super-admin" className="btn-primary">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/super-admin" className="inline-flex items-center text-gray-600 hover:text-gray-900 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            formData.status === 'active'   ? 'bg-green-100 text-green-700'   :
            formData.status === 'paused'   ? 'bg-yellow-100 text-yellow-700' :
                                             'bg-gray-100 text-gray-600'
          }`}>{formData.status.toUpperCase()}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          {/* Branch hero with logo */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-8 py-6 flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo
                  ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                  : logoPreview
                    ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                    : <Store className="w-8 h-8 text-white/50" />
                }
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-brand-orange rounded-full p-1.5 shadow-lg hover:bg-orange-600 transition-colors"
              >
                <Upload className="w-3 h-3 text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">{branch?.displayName}</h1>
              <p className="text-white/60 text-sm font-mono">/{branch?.slug}</p>
              <p className="text-white/40 text-xs mt-1">Click logo to change</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'text-brand-orange border-b-2 border-brand-orange bg-orange-50/50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="p-8">

            {/* ── TAB: Branch Info ── */}
            {activeTab === 'info' && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-gray-900">Branch Information</h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch Name *</label>
                    <input type="text" className="input-field"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
                    <input type="text" className="input-field"
                      value={formData.displayName}
                      onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug (URL path)</label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">/</span>
                      <input type="text" className="input-field rounded-l-none"
                        value={formData.slug}
                        onChange={e => setFormData(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select className="input-field" value={formData.status}
                      onChange={e => setFormData(p => ({ ...p, status: e.target.value as BranchData['status'] }))}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" /> Contact Details
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Email</label>
                      <input type="email" className="input-field" value={formData.contactEmail}
                        onChange={e => setFormData(p => ({ ...p, contactEmail: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Phone</label>
                      <input type="tel" className="input-field" value={formData.contactPhone}
                        onChange={e => setFormData(p => ({ ...p, contactPhone: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum Order Value (R)</label>
                  <input type="number" className="input-field max-w-xs" value={formData.minimumOrderValue}
                    onChange={e => setFormData(p => ({ ...p, minimumOrderValue: Number(e.target.value) }))} />
                </div>
              </div>
            )}

            {/* ── TAB: Location & Delivery ── */}
            {activeTab === 'delivery' && (
              <div className="space-y-6">

                {/* Store Location */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-brand-orange" /> Store Location
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Used to calculate delivery distances and fees.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                      <input type="text" className="input-field"
                        value={formData.storeLocation.address}
                        onChange={e => setFormData(p => ({ ...p, storeLocation: { ...p.storeLocation, address: e.target.value } }))}
                        placeholder="Full store address"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Latitude</label>
                        <input type="number" step="0.0001" className="input-field"
                          value={formData.storeLocation.lat}
                          onChange={e => setFormData(p => ({ ...p, storeLocation: { ...p.storeLocation, lat: Number(e.target.value) } }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Longitude</label>
                        <input type="number" step="0.0001" className="input-field"
                          value={formData.storeLocation.lng}
                          onChange={e => setFormData(p => ({ ...p, storeLocation: { ...p.storeLocation, lng: Number(e.target.value) } }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Pricing */}
                <div className="border-t pt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-brand-orange" /> Delivery Pricing
                  </h2>
                  <p className="text-sm text-gray-500 mb-5">Set prices per delivery zone radius.</p>

                  <div className="space-y-4">
                    {[
                      { label: 'Local Delivery',   priceKey: 'local',  radiusKey: 'localRadius'  },
                      { label: 'Medium Distance',  priceKey: 'medium', radiusKey: 'mediumRadius' },
                      { label: 'Far Distance',     priceKey: 'far',    radiusKey: 'farRadius'    },
                    ].map(({ label, priceKey, radiusKey }) => (
                      <div key={priceKey} className="bg-gray-50 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (R)</label>
                            <input type="number" className="input-field"
                              value={(formData.deliveryPricing as any)[priceKey]}
                              onChange={e => updateDelivery(priceKey, Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Radius (km)</label>
                            <input type="number" className="input-field"
                              value={(formData.deliveryPricing as any)[radiusKey]}
                              onChange={e => updateDelivery(radiusKey, Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          R{(formData.deliveryPricing as any)[priceKey]} for deliveries within {(formData.deliveryPricing as any)[radiusKey]}km
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Admin Credentials ── */}
            {activeTab === 'admin' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <User className="w-5 h-5 text-brand-orange" /> Branch Admin Account
                  </h2>
                  <p className="text-sm text-gray-500">
                    Update the name, login email, or password for this branch's admin.
                    Leave password blank to keep it unchanged.
                  </p>
                </div>

                {adminUser ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Editing admin: <strong>{adminUser.email}</strong>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 text-sm text-yellow-700">
                    No admin found for this branch. Saving will create one.
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Name</label>
                    <input type="text" className="input-field" value={adminForm.name}
                      onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Login Email</label>
                    <input type="email" className="input-field" value={adminForm.email}
                      onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="admin@branch.co.za"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-gray-400" /> Change Password
                    </h3>
                    <div className="space-y-3">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input-field pr-10"
                          value={adminForm.newPassword}
                          onChange={e => setAdminForm(p => ({ ...p, newPassword: e.target.value }))}
                          placeholder="Leave blank to keep current"
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input-field"
                          value={adminForm.confirmPassword}
                          onChange={e => setAdminForm(p => ({ ...p, confirmPassword: e.target.value }))}
                          placeholder="Repeat new password"
                        />
                        {adminForm.newPassword && adminForm.confirmPassword && adminForm.newPassword !== adminForm.confirmPassword && (
                          <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveAdmin} disabled={savingAdmin}
                  className="btn-primary flex items-center gap-2">
                  {savingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingAdmin ? 'Saving...' : 'Update Admin Credentials'}
                </button>
              </div>
            )}

            {/* Save button for info + delivery tabs */}
            {activeTab !== 'admin' && (
              <div className="mt-8 pt-6 border-t flex items-center gap-4">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <Link href="/super-admin" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}