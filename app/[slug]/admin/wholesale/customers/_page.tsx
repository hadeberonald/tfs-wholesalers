'use client';

import { useState, useEffect } from 'react';
import {
  Users, Building2, Mail, Phone, MapPin, Search, Filter,
  Settings, AlertTriangle, CreditCard, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminVerifyCustomerModal from '@/components/AdminVerifyCustomerModal';

interface WholesaleCustomer {
  _id: string;
  userId: string;
  businessName: string;
  businessType: string;
  registrationNumber?: string;
  vatNumber?: string;
  contactPerson: string;
  email: string;
  phone: string;
  businessAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  verificationStatus: 'pending' | 'approved' | 'rejected';
  expectedAnnualSpend?: number;
  creditApproved?: boolean;
  creditLimit?: number;
  netTerms?: number;
  outstandingBalance?: number;
  blockedFromOrdering?: boolean;
  createdAt: string;
}

export default function AdminWholesaleCustomersPage() {
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [creditThreshold, setCreditThreshold] = useState(50000);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ creditThreshold: 50000, defaultNetTerms: 30, defaultCreditLimit: 10000 });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchSettings();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wholesale/customers?all=true');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
      } else {
        toast.error('Failed to load customers');
      }
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/wholesale/settings');
      if (res.ok) {
        const data = await res.json();
        setCreditThreshold(data.settings.creditThreshold);
        setSettingsDraft({
          creditThreshold: data.settings.creditThreshold,
          defaultNetTerms: data.settings.defaultNetTerms,
          defaultCreditLimit: data.settings.defaultCreditLimit,
        });
      }
    } catch { /* ignore */ }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/wholesale/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsDraft),
      });
      if (res.ok) {
        setCreditThreshold(settingsDraft.creditThreshold);
        toast.success('Settings saved');
        setShowSettings(false);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUnblock = async (customerId: string) => {
    try {
      const res = await fetch(`/api/wholesale/customers/${customerId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus: 'approved', unblockOnly: true }),
      });
      if (res.ok) { toast.success('Customer unblocked'); fetchCustomers(); }
      else toast.error('Failed to unblock');
    } catch { toast.error('Failed to unblock'); }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchSearch =
      c.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.verificationStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = customers.filter((c) => c.verificationStatus === 'pending').length;
  const approvedCount = customers.filter((c) => c.verificationStatus === 'approved').length;
  const blockedCount = customers.filter((c) => c.blockedFromOrdering).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-black mb-1">Wholesale Customers</h1>
            <p className="text-gray-600">Manage accounts, verifications and credit</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Wholesale Settings
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-bold text-brand-black mb-4">Wholesale Settings</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credit Threshold (R/year)
                </label>
                <input
                  type="number"
                  value={settingsDraft.creditThreshold}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, creditThreshold: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Min annual spend to qualify for credit
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Net Terms (days)
                </label>
                <select
                  value={settingsDraft.defaultNetTerms}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultNetTerms: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>Net {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Credit Limit (R)
                </label>
                <input
                  type="number"
                  value={settingsDraft.defaultCreditLimit}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultCreditLimit: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-6 py-2 bg-brand-orange text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 text-sm"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total</p>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-brand-black">{customers.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-6 shadow-sm border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-yellow-800">Pending</p>
              <Users className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-6 shadow-sm border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-800">Approved</p>
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{approvedCount}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-6 shadow-sm border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-red-800">Blocked (Overdue)</p>
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900">{blockedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer._id} className={`hover:bg-gray-50 ${customer.blockedFromOrdering ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-orange/10 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-brand-orange" />
                          </div>
                          <div>
                            <p className="font-semibold text-brand-black flex items-center gap-2">
                              {customer.businessName}
                              {customer.blockedFromOrdering && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{customer.businessType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-brand-black">{customer.contactPerson}</p>
                        <p className="text-gray-500">{customer.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {customer.creditApproved ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              <CreditCard className="w-3 h-3" /> Credit
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              R{customer.creditLimit?.toLocaleString()} · Net {customer.netTerms}
                            </p>
                          </div>
                        ) : customer.verificationStatus === 'approved' ? (
                          <span className="text-xs text-gray-400">Cash/EFT only</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {(customer.outstandingBalance ?? 0) > 0 ? (
                          <span className="font-semibold text-red-600">
                            R{customer.outstandingBalance!.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">R0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {customer.verificationStatus === 'pending' && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>
                        )}
                        {customer.verificationStatus === 'approved' && !customer.blockedFromOrdering && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Approved</span>
                        )}
                        {customer.verificationStatus === 'approved' && customer.blockedFromOrdering && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Blocked</span>
                        )}
                        {customer.verificationStatus === 'rejected' && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Rejected</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-brand-orange hover:text-orange-600 font-medium text-sm"
                          >
                            {customer.verificationStatus === 'pending' ? 'Review' : 'Details'}
                          </button>
                          {customer.blockedFromOrdering && (
                            <button
                              onClick={() => handleUnblock(customer._id)}
                              className="text-green-600 hover:text-green-700 font-medium text-sm"
                            >
                              Unblock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Verify Modal */}
      {selectedCustomer && (
        <AdminVerifyCustomerModal
          customer={selectedCustomer}
          creditThreshold={creditThreshold}
          onClose={() => setSelectedCustomer(null)}
          onSuccess={() => { setSelectedCustomer(null); fetchCustomers(); }}
        />
      )}
    </div>
  );
}