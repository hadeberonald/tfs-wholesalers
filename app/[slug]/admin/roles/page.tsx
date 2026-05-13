'use client';

/**
 * app/[slug]/admin/roles/page.tsx
 *
 * Role Management UI.
 * - Lists all roles with their permission counts
 * - Create / edit roles with a grouped permission picker
 * - Delete non-system roles
 * - Requires roles:read (view) / roles:write (create/edit/delete)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, ShieldCheck, ChevronDown, ChevronUp,
  Save, X, Loader2, Lock, CheckSquare, Square, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/RoleGuard';
import {
  ROUTE_MANIFEST,
  MANIFEST_GROUPS,
  getAllPermissions,
  type RouteManifestEntry,
} from '@/lib/route-manifest';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleDoc {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  permissions: string[];
}

const EMPTY_FORM: FormData = { name: '', description: '', permissions: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All manifest entries grouped by group label */
const manifestByGroup = MANIFEST_GROUPS.reduce(
  (acc, group) => {
    acc[group] = ROUTE_MANIFEST.filter((r) => r.group === group);
    return acc;
  },
  {} as Record<string, RouteManifestEntry[]>
);

/** Build the permission rows for a manifest entry */
function entryPermissions(entry: RouteManifestEntry): string[] {
  const perms = [`${entry.key}:read`];
  if (entry.writeEnabled !== false) perms.push(`${entry.key}:write`);
  return perms;
}

// ─── Inner component (rendered after RoleGuard) ───────────────────────────────

function RolesPage() {
  const { can } = useAuth();
  const canWrite = can('roles:write');

  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDoc | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(MANIFEST_GROUPS)
  );
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/roles');
      if (!res.ok) { toast.error('Failed to load roles'); return; }
      const data = await res.json();
      setRoles(data.roles ?? []);
      setAllPermissions(data.allPermissions ?? getAllPermissions());
    } finally {
      setLoading(false);
    }
  };

  // ── Permission toggle helpers ──────────────────────────────────────────────

  const togglePermission = (perm: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleGroup = (group: string, checked: boolean) => {
    const groupPerms = manifestByGroup[group]?.flatMap(entryPermissions) ?? [];
    setFormData((prev) => ({
      ...prev,
      permissions: checked
        ? Array.from(new Set([...prev.permissions, ...groupPerms]))
        : prev.permissions.filter((p) => !groupPerms.includes(p)),
    }));
  };

  const toggleAll = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked ? [...allPermissions] : [],
    }));
  };

  const groupCheckedState = (group: string): 'all' | 'some' | 'none' => {
    const groupPerms = manifestByGroup[group]?.flatMap(entryPermissions) ?? [];
    const selected = groupPerms.filter((p) => formData.permissions.includes(p));
    if (selected.length === 0) return 'none';
    if (selected.length === groupPerms.length) return 'all';
    return 'some';
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRole(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (role: RoleDoc) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description, permissions: [...role.permissions] });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error('Role name is required'); return; }
    setSaving(true);
    try {
      const url = editingRole ? `/api/admin/roles/${editingRole._id}` : '/api/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save role');
        return;
      }
      toast.success(editingRole ? 'Role updated' : 'Role created');
      closeModal();
      fetchRoles();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: RoleDoc) => {
    if (role.isSystem) { toast.error('System roles cannot be deleted.'); return; }
    if (!confirm(`Delete role "${role.name}"? Users assigned this role will lose their permissions.`)) return;
    const res = await fetch(`/api/admin/roles/${role._id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Role deleted'); fetchRoles(); }
    else { const e = await res.json(); toast.error(e.error || 'Failed to delete'); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Roles & Permissions</h1>
            <p className="text-gray-500 mt-1">
              Create roles and control which pages each role can access.
            </p>
          </div>
          {canWrite && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> New Role
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-800">
          <p className="font-semibold mb-1">How roles work</p>
          <p className="text-blue-700">
            Each role is a named collection of permissions. Permissions are derived automatically
            from the <code className="bg-blue-100 px-1 rounded">route-manifest.ts</code> file —
            adding a new admin page there makes it appear here immediately.
            Assign roles to users from the <strong>Users</strong> page.
          </p>
        </div>

        {/* Role list */}
        <div className="space-y-3">
          {roles.map((role) => {
            const isExpanded = expandedRole === role._id;
            const permCount = role.permissions.length;
            const totalPerms = allPermissions.length;

            return (
              <div key={role._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Role row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role._id)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-500" />
                        : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>

                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-orange-500" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        {role.isSystem && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                            <Lock className="w-3 h-3" /> System
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-500 truncate">{role.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    {/* Permission count pill */}
                    <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-600 text-xs font-semibold rounded-full border border-orange-200">
                      {permCount} / {totalPerms} permissions
                    </span>

                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Edit role"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDelete(role)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded permission view */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {MANIFEST_GROUPS.map((group) => {
                        const entries = manifestByGroup[group] ?? [];
                        const groupPerms = entries.flatMap(entryPermissions);
                        const grantedInGroup = groupPerms.filter((p) =>
                          role.permissions.includes(p)
                        );
                        if (grantedInGroup.length === 0) return null;
                        return (
                          <div key={group}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {group}
                            </p>
                            <div className="space-y-1">
                              {entries.map((entry) => {
                                const perms = entryPermissions(entry);
                                const hasRead = role.permissions.includes(`${entry.key}:read`);
                                const hasWrite = role.permissions.includes(`${entry.key}:write`);
                                if (!hasRead && !hasWrite) return null;
                                return (
                                  <div key={entry.key} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700 font-medium">{entry.label}</span>
                                    <div className="flex gap-1">
                                      {hasRead && (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">R</span>
                                      )}
                                      {hasWrite && (
                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded font-medium">W</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════
              CREATE / EDIT MODAL
         ═══════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl">

            {/* Modal header */}
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role Name *
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Content Editor"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this role do?"
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Permissions
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      {formData.permissions.length} of {allPermissions.length} selected
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAll(true)}
                      className="text-xs text-orange-500 hover:text-orange-700 font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => toggleAll(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {MANIFEST_GROUPS.map((group) => {
                    const entries = manifestByGroup[group] ?? [];
                    if (entries.length === 0) return null;
                    const state = groupCheckedState(group);
                    const isGroupExpanded = expandedGroups.has(group);

                    return (
                      <div key={group}>
                        {/* Group header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                          <div className="flex items-center gap-2">
                            {/* Group checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleGroup(group, state !== 'all')}
                              className="flex-shrink-0"
                            >
                              {state === 'all'
                                ? <CheckSquare className="w-4 h-4 text-orange-500" />
                                : state === 'some'
                                ? <CheckSquare className="w-4 h-4 text-orange-300" />
                                : <Square className="w-4 h-4 text-gray-300" />}
                            </button>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              {group}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedGroups((prev) => {
                                const s = new Set(prev);
                                s.has(group) ? s.delete(group) : s.add(group);
                                return s;
                              });
                            }}
                            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            {isGroupExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </div>

                        {/* Permission rows */}
                        {isGroupExpanded && (
                          <div className="px-4 py-2 space-y-1">
                            {entries.map((entry) => {
                              const perms = entryPermissions(entry);
                              const Icon = entry.icon;
                              return (
                                <div
                                  key={entry.key}
                                  className="flex items-center justify-between py-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm text-gray-700">{entry.label}</span>
                                    {entry.alwaysVisible && (
                                      <span className="text-xs text-gray-400 italic">(always visible)</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {/* Read toggle */}
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 accent-blue-500 rounded"
                                        checked={formData.permissions.includes(`${entry.key}:read`)}
                                        onChange={() => togglePermission(`${entry.key}:read`)}
                                        disabled={entry.alwaysVisible}
                                      />
                                      <span className="text-xs text-blue-600 font-semibold">Read</span>
                                    </label>

                                    {/* Write toggle */}
                                    {entry.writeEnabled !== false && (
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="w-3.5 h-3.5 accent-emerald-500 rounded"
                                          checked={formData.permissions.includes(`${entry.key}:write`)}
                                          onChange={() => togglePermission(`${entry.key}:write`)}
                                        />
                                        <span className="text-xs text-emerald-600 font-semibold">Write</span>
                                      </label>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t flex items-center justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
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
                  : <><Save className="w-4 h-4" /> {editingRole ? 'Update Role' : 'Create Role'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Default export wrapped in RoleGuard ─────────────────────────────────────

export default function RolesPageWithGuard() {
  return (
    <RoleGuard routeKey="roles">
      <RolesPage />
    </RoleGuard>
  );
}
