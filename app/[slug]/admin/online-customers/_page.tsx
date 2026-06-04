'use client';

/**
 * app/[slug]/admin/online-customers/_page.tsx
 *
 * Online Customers management page.
 * Links e-commerce customers to their in-store till account numbers.
 * Account numbers appear on order records, receipts, and internal emails.
 *
 * Requires online-customers:read (view) / online-customers:write (create/edit/delete)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Search, Loader2, X, Save,
  Contact2, Hash, Mail, Phone, StickyNote,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

// ─── Types ─────────────────────────────────────────────────────────────────

interface OnlineCustomer {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  tillAccountNumber?: string | null;
  notes?: string | null;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  tillAccountNumber: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  tillAccountNumber: '',
  notes: '',
};

// ─── Page component (no RoleGuard — handled by page.tsx wrapper) ────────────

export default function OnlineCustomersPage() {
  const { can } = useAuth();
  const canWrite = can('online-customers:write');

  const [customers, setCustomers] = useState<OnlineCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<OnlineCustomer | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/admin/customers${params}`);
      if (!res.ok) { toast.error('Failed to load customers'); return; }
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (c: OnlineCustomer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      email: c.email,
      phone: c.phone ?? '',
      tillAccountNumber: c.tillAccountNumber ?? '',
      notes: c.notes ?? '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
  };

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.email.trim()) { toast.error('Email is required'); return; }

    setSaving(true);
    try {
      const url = editingCustomer
        ? `/api/admin/customers/${editingCustomer._id}`
        : '/api/admin/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save customer record');
        return;
      }

      toast.success(editingCustomer ? 'Customer record updated' : 'Customer record created');
      closeModal();
      fetchCustomers();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: OnlineCustomer) => {
    if (
      !confirm(
        `Delete the account record for ${c.name}?\n\nThis will remove the till account number link but won't affect their order history.`
      )
    ) return;

    const res = await fetch(`/api/admin/customers/${c._id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Customer record deleted');
      fetchCustomers();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to delete');
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────

  const withAccount    = customers.filter((c) => c.tillAccountNumber).length;
  const withoutAccount = customers.length - withAccount;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Online Customers</h1>
            <p className="text-gray-500 mt-1">
              Link online shoppers to their in-store till account numbers.
            </p>
          </div>
          {canWrite && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> Add Customer
            </button>
          )}
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-800">
          <p className="font-semibold mb-1">How this works</p>
          <p className="text-blue-700">
            Each record links an online customer's email address to their in-store till account number.
            Once linked, the account number automatically appears on every order record, internal receipt
            email, and order export — so cashiers can ring up online sales on the till with one lookup.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Records',   value: customers.length, color: 'bg-blue-500',   icon: Contact2     },
            { label: 'Linked to Till',  value: withAccount,      color: 'bg-green-500',  icon: CheckCircle2 },
            { label: 'No Till Account', value: withoutAccount,   color: 'bg-yellow-500', icon: AlertCircle  },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-0.5">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or till account number…"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Customer list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center shadow-sm border border-gray-100">
            <Contact2 className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {search ? 'No customers matched' : 'No customer records yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {search
                ? 'Try a different search term'
                : 'Add your first customer record to link an online shopper to a till account.'}
            </p>
            {!search && canWrite && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Till Account #</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Added</th>
                    {canWrite && (
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-orange-50/20 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-orange-600 font-bold text-sm">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {customer.tillAccountNumber ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                            <Hash className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            <span className="font-mono font-semibold text-green-700 text-sm">
                              {customer.tillAccountNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not linked</span>
                        )}
                      </td>

                      <td className="px-5 py-4 hidden lg:table-cell">
                        {customer.notes ? (
                          <div className="flex items-start gap-1.5 text-xs text-gray-500 max-w-xs">
                            <StickyNote className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{customer.notes}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 hidden md:table-cell text-xs text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>

                      {canWrite && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(customer)}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(customer)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════
              CREATE / EDIT MODAL
         ═══════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full my-8 shadow-2xl">

            {/* Modal header */}
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer Record' : 'Add Customer Record'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Till Account Number — most prominent field */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="w-4 h-4 text-orange-500" />
                  <label className="text-sm font-semibold text-orange-700">
                    Till Account Number
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  This number will appear on all order records, receipts, and internal emails
                  for orders placed by this customer.
                </p>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-orange-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  value={formData.tillAccountNumber}
                  onChange={(e) => setFormData({ ...formData, tillAccountNumber: e.target.value })}
                  placeholder="e.g. ACC-00421"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer's full name"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@email.com"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Must match the email used when placing online orders.
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="082 123 4567"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes about this customer…"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t flex items-center justify-end gap-3 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> {editingCustomer ? 'Update Record' : 'Save Record'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}