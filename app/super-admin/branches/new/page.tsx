'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayName: '',
    storeLocation: {
      lat: -29.8587,
      lng: 31.0218,
      address: ''
    },
    contactEmail: '',
    contactPhone: '',
    deliveryPricing: {
      local: 50,
      localRadius: 5,
      medium: 100,
      mediumRadius: 15,
      far: 150,
      farRadius: 30,
    },
    minimumOrderValue: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const handleDeliveryPricingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      deliveryPricing: {
        ...prev.deliveryPricing,
        [name]: parseFloat(value) || 0
      }
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      storeLocation: {
        ...prev.storeLocation,
        [name]: name === 'address' ? value : parseFloat(value) || 0
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/super-admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          displayName: formData.displayName || formData.name,
          settings: {
            storeLocation: formData.storeLocation,
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
            deliveryPricing: formData.deliveryPricing,
            minimumOrderValue: formData.minimumOrderValue,
          },
          paymentConfig: {
            paystack: {
              enabled: true,
              publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
              secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            }
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create branch');
      }

      alert(`Branch created successfully!\n\nAdmin Login:\nEmail: ${data.defaultAdmin.email}\nPassword: ${data.defaultAdmin.password}`);
      router.push('/super-admin/branches');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/super-admin/branches"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Branches
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Create New Branch</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Branch Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Pietermaritzburg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Slug (URL) *</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., pmb"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Will be used in URL: /{formData.slug}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank to use branch name"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Contact Information</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="branch@tfswholesalers.co.za"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contact Phone *</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+27 33 123 4567"
                />
              </div>
            </div>

            {/* Store Location */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Store Location</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.storeLocation.address}
                  onChange={handleLocationChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Full store address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    name="lat"
                    value={formData.storeLocation.lat}
                    onChange={handleLocationChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    name="lng"
                    value={formData.storeLocation.lng}
                    onChange={handleLocationChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Pricing */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Delivery Pricing</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Local (R)</label>
                  <input
                    type="number"
                    name="local"
                    value={formData.deliveryPricing.local}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Radius (km)</label>
                  <input
                    type="number"
                    name="localRadius"
                    value={formData.deliveryPricing.localRadius}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Medium (R)</label>
                  <input
                    type="number"
                    name="medium"
                    value={formData.deliveryPricing.medium}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Radius (km)</label>
                  <input
                    type="number"
                    name="mediumRadius"
                    value={formData.deliveryPricing.mediumRadius}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Far (R)</label>
                  <input
                    type="number"
                    name="far"
                    value={formData.deliveryPricing.far}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Radius (km)</label>
                  <input
                    type="number"
                    name="farRadius"
                    value={formData.deliveryPricing.farRadius}
                    onChange={handleDeliveryPricingChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Other Settings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Other Settings</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Minimum Order Value (R)</label>
                <input
                  type="number"
                  name="minimumOrderValue"
                  value={formData.minimumOrderValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimumOrderValue: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Branch'}
              </button>
              <Link
                href="/super-admin/branches"
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}