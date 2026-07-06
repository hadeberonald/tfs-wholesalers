'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, X, Tag, Truck, Percent, Banknote,
  AlertCircle, Calendar, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

type PromoType = 'free_delivery' | 'percentage' | 'fixed_amount';

interface PromoCode {
  _id: string;
  branchId: string;
  code: string;
  type: PromoType;
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  usedCount: number;
  startDate?: string | null;
  expiryDate?: string | null;
  active: boolean;
  description?: string;
  createdAt: string;
}

interface FormData {
  code: string;
  type: PromoType;
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  startDate: string;
  expiryDate: string;
  active: boolean;
  description: string;
}

const EMPTY_FORM: FormData = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  usageLimitPerCustomer: '',
  startDate: '',
  expiryDate: '',
  active: true,
  description: '',
};

const TYPE_META: Record<PromoType, { label: string; icon: any; color: string }> = {
  free_delivery: { label: 'Free Delivery', icon: Truck, color: 'text-blue-600 bg-blue-100' },
  percentage: { label: '% Off', icon: Percent, color: 'text-purple-600 bg-purple-100' },
  fixed_amount: { label: 'Amount Off', icon: Banknote, color: 'text-green-600 bg-green-100' },
};

function getStatus(promo: PromoCode): { label: string; color: string } {
  const now = Date.now();
  if (!promo.active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' };
  if (promo.expiryDate && new Date(promo.expiryDate).getTime() < now) {
    return { label: 'Expired', color: 'bg-red-100 text-red-700' };
  }
  if (promo.startDate && new Date(promo.startDate).getTime() > now) {
    return { label: 'Scheduled', color: 'bg-amber-100 text-amber-700' };
  }
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
    return { label: 'Limit reached', color: 'bg-red-100 text-red-700' };
  }
  return { label: 'Active', color: 'bg-green-100 text-green-700' };
}

export default function AdminPromoCodesPage() {
  const { branch, loading: branchLoading } = useBranch();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchPromoCodes();
    }
  }, [branchLoading, branch]);

  async function fetchPromoCodes() {
    try {
      setLoading(true);
      const res = await fetch(`/api/promo-codes?branchId=${branch?.id}`);
      if (res.ok) {
        const data = await res.json();
        setPromoCodes(data.promoCodes || []);
      } else {
        toast.error('Failed to load promo codes');
      }
    } catch (e) {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData(EMPTY_FORM);
    setEditing(null);
  }

  function handleEdit(promo: PromoCode) {
    setEditing(promo);
    setFormData({
      code: promo.code,
      type: promo.type,
      value: promo.type === 'free_delivery' ? '' : String(promo.value),
      minOrderValue: promo.minOrderValue ? String(promo.minOrderValue) : '',
      maxDiscount: promo.maxDiscount ? String(promo.maxDiscount) : '',
      usageLimit: promo.usageLimit ? String(promo.usageLimit) : '',
      usageLimitPerCustomer: promo.usageLimitPerCustomer ? String(promo.usageLimitPerCustomer) : '',
      startDate: promo.startDate ? promo.startDate.split('T')[0] : '',
      expiryDate: promo.expiryDate ? promo.expiryDate.split('T')[0] : '',
      active: promo.active,
      description: promo.description || '',
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formData.code.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (formData.type !== 'free_delivery') {
      const numValue = parseFloat(formData.value);
      if (!formData.value || isNaN(numValue) || numValue <= 0) {
        toast.error('Please enter a valid discount value');
        return;
      }
      if (formData.type === 'percentage' && numValue > 100) {
        toast.error('Percentage cannot exceed 100%');
        return;
      }
    }
    if (!branch) {
      toast.error('Branch not loaded');
      return;
    }

    const payload = {
      branchId: branch.id,
      code: formData.code.trim(),
      type: formData.type,
      value: formData.type === 'free_delivery' ? 0 : parseFloat(formData.value),
      minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : undefined,
      maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : undefined,
      usageLimitPerCustomer: formData.usageLimitPerCustomer ? parseInt(formData.usageLimitPerCustomer, 10) : undefined,
      startDate: formData.startDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      active: formData.active,
      description: formData.description || undefined,
    };

    try {
      setSaving(true);
      const url = editing ? `/api/promo-codes/${editing._id}` : '/api/promo-codes';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editing ? 'Promo code updated' : 'Promo code created');
        setShowModal(false);
        resetForm();
        fetchPromoCodes();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save promo code');
      }
    } catch (e) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(promo: PromoCode) {
    const ok = confirm(`Delete promo code "${promo.code}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/promo-codes/${promo._id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Promo code deleted');
        fetchPromoCodes();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to delete promo code');
      }
    } catch (e) {
      toast.error('An error occurred');
    }
  }

  async function handleToggleActive(promo: PromoCode) {
    try {
      const res = await fetch(`/api/promo-codes/${promo._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !promo.active }),
      });
      if (res.ok) {
        toast.success(promo.active ? 'Promo code deactivated' : 'Promo code activated');
        fetchPromoCodes();
      } else {
        toast.error('Failed to update status');
      }
    } catch (e) {
      toast.error('An error occurred');
    }
  }

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function describeValue(promo: PromoCode): string {
    if (promo.type === 'free_delivery') return 'Free delivery';
    if (promo.type === 'percentage') {
      return `${promo.value}% off${promo.maxDiscount ? ` (max R${promo.maxDiscount.toFixed(2)})` : ''}`;
    }
    return `R${promo.value.toFixed(2)} off`;
  }

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
            <h1 className="text-4xl font-bold text-brand-black mb-2">Promo Codes</h1>
            <p className="text-gray-600">
              Manage discount and free-delivery codes for {branch ? branch.displayName : ''}.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center space-x-2 bg-brand-orange text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Promo Code</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
          </div>
        ) : promoCodes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No promo codes yet</h3>
            <p className="text-gray-600 mb-6">Create your first promo code to get started</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              New Promo Code
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Discount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Usage</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {promoCodes.map((promo) => {
                    const meta = TYPE_META[promo.type];
                    const Icon = meta.icon;
                    const status = getStatus(promo);
                    return (
                      <tr key={promo._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-black">{promo.code}</span>
                            <button
                              onClick={() => handleCopy(promo.code, promo._id)}
                              className="text-gray-400 hover:text-brand-orange"
                              title="Copy code"
                            >
                              {copiedId === promo._id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {promo.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{promo.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${meta.color}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {describeValue(promo)}
                          {promo.minOrderValue && (
                            <p className="text-xs text-gray-400">Min order R{promo.minOrderValue.toFixed(2)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {promo.usedCount}{promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
                          {promo.usageLimitPerCustomer && (
                            <p className="text-xs text-gray-400">Max {promo.usageLimitPerCustomer}/customer</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {promo.expiryDate ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(promo.expiryDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">No expiry</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(promo)}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${status.color} hover:opacity-80 transition-opacity`}
                          >
                            {status.label}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(promo)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(promo)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-brand-black">
                  {editing ? 'Edit Promo Code' : 'New Promo Code'}
                </h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent font-mono"
                    placeholder="e.g. WELCOME10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(TYPE_META) as PromoType[]).map((t) => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      const isSelected = formData.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({ ...formData, type: t })}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                            isSelected ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-orange' : 'text-gray-400'}`} />
                          <span className={`text-xs font-medium ${isSelected ? 'text-brand-orange' : 'text-gray-600'}`}>
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formData.type !== 'free_delivery' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.type === 'percentage' ? 'Percentage *' : 'Amount (R) *'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formData.type === 'percentage' ? 100 : undefined}
                        step="0.01"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                        placeholder={formData.type === 'percentage' ? 'e.g. 10' : 'e.g. 50.00'}
                      />
                    </div>
                    {formData.type === 'percentage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Max Discount (R)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.maxDiscount}
                          onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                          placeholder="Optional cap"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Value (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    placeholder="Optional — e.g. 200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Usage Limit</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Limit Per Customer</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usageLimitPerCustomer}
                      onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Internal Description</label>
                  <textarea
                    value={formData.description}
                    rows={2}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    placeholder="e.g. Instagram launch promo, July 2026"
                  />
                </div>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>

                {editing && formData.expiryDate && new Date(formData.expiryDate) < new Date() && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>This promo code is currently expired and cannot be redeemed.</span>
                  </p>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
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