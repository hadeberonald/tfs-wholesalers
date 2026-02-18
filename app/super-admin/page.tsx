'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Store, 
  Plus, 
  Users, 
  Settings, 
  Activity,
  Pause,
  Play,
  Trash2,
  Edit,
  Loader2,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  settings: {
    storeLocation: {
      address: string;
    };
  };
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super-admin')) {
      router.push('/login');
    } else if (user?.role === 'super-admin') {
      fetchBranches();
    }
  }, [user, authLoading, router]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/super-admin/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const toggleBranchStatus = async (branchId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    try {
      const res = await fetch(`/api/super-admin/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Branch ${newStatus === 'active' ? 'activated' : 'paused'}`);
        fetchBranches();
      } else {
        toast.error('Failed to update branch');
      }
    } catch (error) {
      toast.error('Failed to update branch');
    }
  };

  const deleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Are you sure you want to delete ${branchName}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/branches/${branchId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Branch deleted');
        fetchBranches();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete branch');
      }
    } catch (error) {
      toast.error('Failed to delete branch');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'super-admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-brand-black mb-2">Super Admin Dashboard</h1>
              <p className="text-gray-600">Manage all branches and system-wide settings</p>
            </div>
            <Link 
              href="/super-admin/branches/new"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Branch</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Store className="w-8 h-8" />
            </div>
            <p className="text-white/80 text-sm mb-1">Total Branches</p>
            <p className="text-3xl font-bold">{branches.length}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8" />
            </div>
            <p className="text-white/80 text-sm mb-1">Active Branches</p>
            <p className="text-3xl font-bold">{branches.filter(b => b.status === 'active').length}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Pause className="w-8 h-8" />
            </div>
            <p className="text-white/80 text-sm mb-1">Paused Branches</p>
            <p className="text-3xl font-bold">{branches.filter(b => b.status === 'paused').length}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-white/80 text-sm mb-1">System Users</p>
            <p className="text-3xl font-bold">-</p>
          </div>
        </div>

        {/* Branches List */}
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-brand-black">All Branches</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {branches.length === 0 ? (
              <div className="p-12 text-center">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Branches Yet</h3>
                <p className="text-gray-600 mb-6">Create your first branch to get started</p>
                <Link href="/super-admin/branches/new" className="btn-primary inline-flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span>Create First Branch</span>
                </Link>
              </div>
            ) : (
              branches.map((branch) => (
                <div key={branch._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-brand-black">{branch.displayName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          branch.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : branch.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {branch.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{branch.settings.storeLocation.address}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Slug: <span className="font-mono font-semibold">/{branch.slug}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/super-admin/branches/${branch._id}`}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      
                      <button
                        onClick={() => toggleBranchStatus(branch._id, branch.status)}
                        className={`p-2 hover:bg-yellow-100 rounded-lg transition-colors ${
                          branch.status === 'active' ? 'text-yellow-600' : 'text-green-600'
                        }`}
                        title={branch.status === 'active' ? 'Pause' : 'Activate'}
                      >
                        {branch.status === 'active' ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={() => deleteBranch(branch._id, branch.displayName)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <Link
                        href={`/${branch.slug}`}
                        target="_blank"
                        className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg font-semibold text-sm transition-colors"
                      >
                        Visit Store
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}