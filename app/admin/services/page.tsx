'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ServiceRequest, User } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminServicesPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      toast.error('Access denied');
      router.push('/');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [servicesRes, employeesRes] = await Promise.all([
        fetch('/api/service-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const servicesData = await servicesRes.json();
      const employeesData = await employeesRes.json();

      setServiceRequests(servicesData.serviceRequests || []);
      setEmployees(employeesData.employees || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateService = async (serviceId: string, updates: any) => {
    try {
      const res = await fetch(`/api/service-requests/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update service request');

      toast.success('Service request updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filtered = filter === 'all' ? serviceRequests : serviceRequests.filter(s => s.status === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white p-6">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold">Service Request Management</h1>
          <a href="/admin" className="px-4 py-2 bg-white text-primary rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Back to Dashboard
          </a>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-4">
          {['all', 'pending', 'assigned', 'in_progress', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === status ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No {filter !== 'all' ? filter.replace('_', ' ') : ''} service requests found
              </div>
            ) : (
              filtered.map((request) => (
                <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Request {request.request_number}</h3>
                      <p className="text-sm text-gray-500">{formatDate(request.created_at)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(request.status)}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm mb-1">
                        <strong>Type:</strong> {request.service_type}
                      </p>
                      <p className="text-sm mb-1">
                        <strong>Customer:</strong> {request.guest_name || `${request.user?.first_name} ${request.user?.last_name}`}
                      </p>
                      <p className="text-sm mb-1">
                        <strong>Phone:</strong> {request.guest_phone}
                      </p>
                      {request.guest_email && (
                        <p className="text-sm">
                          <strong>Email:</strong> {request.guest_email}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm mb-1">
                        <strong>Address:</strong> {request.address_line1}, {request.city}, {request.province}
                      </p>
                      <p className="text-sm mb-1">
                        <strong>Description:</strong> {request.description}
                      </p>
                      {request.preferred_date && (
                        <p className="text-sm">
                          <strong>Preferred Date:</strong> {formatDate(request.preferred_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Assign Employee</label>
                      <select
                        value={request.assigned_employee_id || ''}
                        onChange={(e) => updateService(request.id, { assigned_employee_id: e.target.value || null })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Unassigned</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                      <select
                        value={request.status}
                        onChange={(e) => updateService(request.id, { status: e.target.value })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      >
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
