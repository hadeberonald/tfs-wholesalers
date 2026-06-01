'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, Users, Search, Package, Truck,
  ShoppingBag, Shield, ShieldCheck, Loader2, X, Save, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminRole {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

interface Branch {
  _id: string;
  name: string;
  slug: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'picker' | 'delivery' | 'admin';
  phone?: string;
  active: boolean;
  activeBranchId?: string;
  activeBranchName?: string;
  adminRoleId?: string | null;
  adminRoleName?: string | null;
  createdAt: string;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  active: boolean;
  adminRoleId: string;
  activeBranchId: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  email: '',
  password: '',
  role: 'customer',
  phone: '',
  active: true,
  adminRoleId: '',
  activeBranchId: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin':    return Shield;
    case 'picker':   return Package;
    case 'delivery': return Truck;
    default:         return ShoppingBag;
  }
};

const getRoleBadgeColor = (role: string) => ({
  admin:    'bg-purple-100 text-purple-800',
  picker:   'bg-blue-100 text-blue-800',
  delivery: 'bg-green-100 text-green-800',
  customer: 'bg-gray-100 text-gray-800',
}[role] ?? 'bg-gray-100 text-gray-800');

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser, can } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super-admin';
  const canWrite = can('users:write');

  const [users, setUsers]           = useState<User[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showModal, setShowModal]   = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData]     = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    fetchUsers();
    fetchAdminRoles();
    fetchBranches();
  }, []);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        toast.error('Failed to load users');
      }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminRoles = async () => {
    try {
      const res = await fetch('/api/admin/roles');
      if (res.ok) {
        const data = await res.json();
        setAdminRoles(data.roles || []);
      }
    } catch {
      console.error('Failed to load admin roles');
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch {
      console.error('Failed to load branches');
    }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const resetForm = () => { setFormData(EMPTY_FORM); setEditingUser(null); };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name:           user.name,
      email:          user.email,
      password:       '',
      role:           user.role,
      phone:          user.phone || '',
      active:         user.active,
      adminRoleId:    user.adminRoleId || '',
      activeBranchId: user.activeBranchId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('User deleted');
        fetchUsers();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to delete user');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    if (formData.role === 'admin' && !formData.activeBranchId) {
      toast.error('Admin users must be assigned to a branch');
      return;
    }

    setSaving(true);
    try {
      const url    = editingUser ? `/api/admin/users/${editingUser._id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload: any = { ...formData };

      // Don't send blank password on edit
      if (editingUser && !formData.password) delete payload.password;

      // Non-admin users don't need these fields
      if (formData.role !== 'admin') {
        delete payload.adminRoleId;
        delete payload.activeBranchId;
      }

      if (!payload.adminRoleId) payload.adminRoleId = null;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingUser ? 'User updated!' : 'User created!');
        setShowModal(false);
        resetForm();
        fetchUsers();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save user');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total:     users.length,
    customers: users.filter(u => u.role === 'customer').length,
    pickers:   users.filter(u => u.role === 'picker').length,
    delivery:  users.filter(u => u.role === 'delivery').length,
    admins:    users.filter(u => u.role === 'admin').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-2">Users</h1>
            <p className="text-gray-600">{users.length} total users</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total',     value: stats.total,     icon: Users,       color: 'bg-blue-500'   },
            { label: 'Customers', value: stats.customers, icon: ShoppingBag, color: 'bg-gray-500'   },
            { label: 'Pickers',   value: stats.pickers,   icon: Package,     color: 'bg-purple-500' },
            { label: 'Delivery',  value: stats.delivery,  icon: Truck,       color: 'bg-green-500'  },
            { label: 'Admins',    value: stats.admins,    icon: Shield,      color: 'bg-orange-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-brand-black mb-0.5">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="picker">Pickers</option>
              <option value="delivery">Delivery Staff</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center shadow-sm">
            <Users className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 text-sm">
              {searchTerm || roleFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Add your first user to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Admin Role</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Branch</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(user => {
                    const RoleIcon = getRoleIcon(user.role);
                    return (
                      <tr key={user._id} className="hover:bg-orange-50/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                            <RoleIcon className="w-3 h-3" />
                            <span className="capitalize">{user.role}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 hidden md:table-cell">
                          {user.role === 'admin' ? (
                            user.adminRoleName ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                <ShieldCheck className="w-3 h-3" />
                                {user.adminRoleName}
                              </span>
                            ) : (
                              <span className="text-xs text-red-400 italic">No role assigned</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 hidden lg:table-cell">
                          {user.activeBranchName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                              <Building2 className="w-3 h-3 text-gray-400" />
                              {user.activeBranchName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            user.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}>
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user._id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              title="Delete user"
                            >
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
      </div>

      {/* ═══════════════════════════════
              ADD / EDIT MODAL
         ═══════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Name + Email */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password {!editingUser && '*'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                />
              </div>

              {/* Phone + Status */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="082 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    value={formData.active ? 'active' : 'inactive'}
                    onChange={e => setFormData({ ...formData, active: e.target.value === 'active' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* System Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">System Role *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value, adminRoleId: '', activeBranchId: '' })}
                >
                  <option value="customer">Customer</option>
                  <option value="picker">Picker</option>
                  <option value="delivery">Delivery Staff</option>
                  {/* Any user with write access can assign the admin role;
                      super-admin is backend-only and never shown here */}
                  {(canWrite || editingUser?.role === 'admin') && (
                    <option value="admin">Admin</option>
                  )}
                </select>
              </div>

              {/* Branch — required for admin users */}
              {formData.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    value={formData.activeBranchId}
                    onChange={e => setFormData({ ...formData, activeBranchId: e.target.value })}
                  >
                    <option value="">— Select a branch —</option>
                    {branches.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                  {!formData.activeBranchId && (
                    <p className="text-xs text-red-500 mt-1">
                      Required — admin users without a branch cannot access the portal.
                    </p>
                  )}
                </div>
              )}

              {/* Admin Role — only shown when role === 'admin' */}
              {formData.role === 'admin' && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-semibold text-orange-700">Admin Role & Permissions</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Assign a role to control which pages and actions this admin can access.
                    Roles are managed in the <strong>Roles</strong> section.
                  </p>
                  <select
                    className="w-full px-4 py-2.5 border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    value={formData.adminRoleId}
                    onChange={e => setFormData({ ...formData, adminRoleId: e.target.value })}
                  >
                    <option value="">— No role assigned (no access) —</option>
                    {adminRoles.map(role => (
                      <option key={role._id} value={role._id}>
                        {role.name}{role.isSystem ? ' ★' : ''} — {role.permissions.length} permissions
                      </option>
                    ))}
                  </select>

                  {formData.adminRoleId && (() => {
                    const selected = adminRoles.find(r => r._id === formData.adminRoleId);
                    return selected ? (
                      <div className="bg-white border border-orange-100 rounded-lg px-3 py-2 text-xs text-gray-600">
                        <span className="font-semibold text-orange-600">{selected.name}:</span>{' '}
                        {selected.description || 'No description.'}
                        <span className="ml-2 text-gray-400">({selected.permissions.length} permissions)</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> {editingUser ? 'Update User' : 'Create User'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}