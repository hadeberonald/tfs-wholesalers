'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Plus, Users, Activity, Pause, Play, Trash2, Edit,
  Loader2, MapPin, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  settings: { storeLocation: { address: string } };
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const router                         = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [branches, setBranches]   = useState<Branch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showBranches, setShowBranches] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super-admin')) router.push('/login');
    else if (user?.role === 'super-admin') fetchAll();
  }, [user, authLoading]);

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/super-admin/branches');
      if (res.ok) setBranches((await res.json()).branches ?? []);
    } catch {
      toast.error('Failed to load branch data');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, cur: string) => {
    const next = cur === 'active' ? 'paused' : 'active';
    const res  = await fetch(`/api/super-admin/branches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) { toast.success(`Branch ${next === 'active' ? 'activated' : 'paused'}`); fetchAll(); }
    else toast.error('Failed to update branch');
  };

  const deleteBranch = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/super-admin/branches/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Branch deleted'); fetchAll(); }
    else toast.error((await res.json()).error ?? 'Failed to delete');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }
  if (!user || user.role !== 'super-admin') return null;

  const Section = ({
    open, setOpen, icon: Icon, title, badge, badgeColor, children,
  }: {
    open: boolean; setOpen: (v: boolean) => void;
    icon: any; title: string; badge?: string; badgeColor?: string; children: React.ReactNode;
  }) => (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Icon className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-brand-black">{title}</h2>
          {badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-gray-100 text-gray-600'}`}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-1">Super Admin</h1>
            <p className="text-gray-600">System-wide management</p>
          </div>
          <Link href="/super-admin/branches/new" className="btn-primary flex items-center space-x-2">
            <Plus className="w-5 h-5" /><span>Create Branch</span>
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <Store className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Total Branches</p>
            <p className="text-3xl font-bold">{branches.length}</p>
            <p className="text-white/60 text-xs mt-1">{branches.filter(b => b.status === 'active').length} active</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
            <Activity className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Active Branches</p>
            <p className="text-3xl font-bold">{branches.filter(b => b.status === 'active').length}</p>
            <p className="text-white/60 text-xs mt-1">Currently serving customers</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white shadow-lg col-span-2 md:col-span-1">
            <Pause className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-white/80 text-xs mb-0.5">Paused / Inactive</p>
            <p className="text-3xl font-bold">{branches.filter(b => b.status !== 'active').length}</p>
            <p className="text-white/60 text-xs mt-1">Branches not currently live</p>
          </div>
        </div>

        {/* Branches List */}
        <Section
          open={showBranches} setOpen={setShowBranches}
          icon={Store} title="All Branches"
          badge={String(branches.length)}
          badgeColor="bg-gray-100 text-gray-600"
        >
          {branches.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Branches Yet</h3>
              <Link href="/super-admin/branches/new" className="btn-primary inline-flex items-center space-x-2">
                <Plus className="w-5 h-5" /><span>Create First Branch</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {branches.map(branch => (
                <div key={branch._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-brand-black">{branch.displayName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          branch.status === 'active'  ? 'bg-green-100 text-green-700' :
                          branch.status === 'paused'  ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-600'
                        }`}>{branch.status.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{branch.settings.storeLocation.address}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">/{branch.slug}</p>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <Link href={`/super-admin/branches/${branch._id}`}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Edit">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => toggleStatus(branch._id, branch.status)}
                        className={`p-2 rounded-lg transition-colors ${
                          branch.status === 'active'
                            ? 'hover:bg-yellow-50 text-yellow-600'
                            : 'hover:bg-green-50 text-green-600'
                        }`}
                      >
                        {branch.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteBranch(branch._id, branch.displayName)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/${branch.slug}/admin`}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors">
                        Admin
                      </Link>
                      <Link href={`/${branch.slug}`} target="_blank"
                        className="px-3 py-1.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors">
                        Store
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}