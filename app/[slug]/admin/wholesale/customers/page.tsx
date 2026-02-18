'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Check, X, Building2, Mail, Phone, MapPin, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

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
  creditTerms?: string;
  currentBalance: number;
  active: boolean;
  createdAt: string;
}

export default function AdminWholesaleCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchCustomers();
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
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (customerId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/wholesale/customers/${customerId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus: status }),
      });

      if (res.ok) {
        toast.success(`Customer ${status === 'approved' ? 'approved' : 'rejected'}`);
        fetchCustomers();
        setShowModal(false);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Failed to verify customer:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || customer.verificationStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = customers.filter(c => c.verificationStatus === 'pending').length;
  const approvedCount = customers.filter(c => c.verificationStatus === 'approved').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">
            Wholesale Customers
          </h1>
          <p className="text-gray-600">
            Manage wholesale customer accounts and verifications
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total Customers</p>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-brand-black">{customers.length}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-6 shadow-sm border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-yellow-800">Pending Approval</p>
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

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-brand-orange bg-opacity-10 rounded-full flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-brand-orange" />
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-brand-black">
                              {customer.businessName}
                            </p>
                            {customer.registrationNumber && (
                              <p className="text-xs text-gray-500">
                                Reg: {customer.registrationNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-brand-black">
                            {customer.contactPerson}
                          </p>
                          <p className="text-gray-600 flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{customer.email}</span>
                          </p>
                          {customer.phone && (
                            <p className="text-gray-600 flex items-center space-x-1">
                              <Phone className="w-3 h-3" />
                              <span>{customer.phone}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          {customer.businessType}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {customer.verificationStatus === 'pending' && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Pending
                          </span>
                        )}
                        {customer.verificationStatus === 'approved' && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Approved
                          </span>
                        )}
                        {customer.verificationStatus === 'rejected' && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowModal(true);
                          }}
                          className="text-brand-orange hover:text-orange-600 font-medium text-sm"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Details Modal */}
      {showModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-brand-black">
                Customer Details
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Business Info */}
              <div>
                <h3 className="font-semibold text-brand-black mb-3 flex items-center space-x-2">
                  <Building2 className="w-5 h-5" />
                  <span>Business Information</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Business Name:</span>
                    <span className="font-semibold">{selectedCustomer.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold">{selectedCustomer.businessType}</span>
                  </div>
                  {selectedCustomer.registrationNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registration:</span>
                      <span className="font-semibold">{selectedCustomer.registrationNumber}</span>
                    </div>
                  )}
                  {selectedCustomer.vatNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">VAT Number:</span>
                      <span className="font-semibold">{selectedCustomer.vatNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold text-brand-black mb-3 flex items-center space-x-2">
                  <Mail className="w-5 h-5" />
                  <span>Contact Information</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contact Person:</span>
                    <span className="font-semibold">{selectedCustomer.contactPerson}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-semibold">{selectedCustomer.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-semibold">{selectedCustomer.phone}</span>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold text-brand-black mb-3 flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Business Address</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <p>{selectedCustomer.businessAddress.street}</p>
                  <p>
                    {selectedCustomer.businessAddress.city}, {selectedCustomer.businessAddress.province} {selectedCustomer.businessAddress.postalCode}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {selectedCustomer.verificationStatus === 'pending' && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleVerify(selectedCustomer._id, 'approved')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>Approve Customer</span>
                  </button>

                  <button
                    onClick={() => handleVerify(selectedCustomer._id, 'rejected')}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                  >
                    <X className="w-5 h-5" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}