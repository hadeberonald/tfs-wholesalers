'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Settings, Truck, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

// Reads the token from localStorage — adjust the key to match where your
// admin login stores it (common keys: 'admin-token', 'token', 'authToken')
function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('admin-token') ?? localStorage.getItem('token')
      : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function AdminSettingsPage() {
  const { branch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [deliveryPricing, setDeliveryPricing] = useState({
    local: 35,
    localRadius: 20,
    medium: 85,
    mediumRadius: 40,
    far: 105,
    farRadius: 60,
  });

  const [storeLocation, setStoreLocation] = useState({
    lat: -29.8587,
    lng: 31.0218,
    address: '123 Main Street, Durban, KZN 4001',
  });

  useEffect(() => {
    if (!branch) return;

    const load = async () => {
      setFetching(true);
      try {
        const headers = getAuthHeaders();

        const [deliveryRes, locationRes] = await Promise.all([
          fetch(`/api/admin/settings/delivery?branchId=${branch.id}`, { headers }),
          fetch(`/api/admin/settings/location?branchId=${branch.id}`, { headers }),
        ]);

        if (deliveryRes.ok) {
          const { settings } = await deliveryRes.json();
          if (settings) {
            setDeliveryPricing({
              local: settings.local ?? 35,
              localRadius: settings.localRadius ?? 20,
              medium: settings.medium ?? 85,
              mediumRadius: settings.mediumRadius ?? 40,
              far: settings.far ?? 105,
              farRadius: settings.farRadius ?? 60,
            });
          }
        }

        if (locationRes.ok) {
          const { location } = await locationRes.json();
          if (location) {
            setStoreLocation({
              lat: location.lat ?? -29.8587,
              lng: location.lng ?? 31.0218,
              address: location.address ?? '',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load current settings');
      } finally {
        setFetching(false);
      }
    };

    load();
  }, [branch]);

  const handleSaveDelivery = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/delivery', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branchId: branch?.id, ...deliveryPricing }),
      });
      if (res.ok) {
        toast.success('Delivery pricing updated successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update delivery pricing');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/location', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branchId: branch?.id, ...storeLocation }),
      });
      if (res.ok) {
        toast.success('Store location updated successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update store location');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <Settings className="w-12 h-12 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl text-brand-black mb-2 flex items-center">
            <Settings className="w-10 h-10 mr-3 text-brand-orange" />
            Settings
          </h1>
          <p className="text-gray-600">
            {branch ? `Managing settings for ${branch.displayName}` : 'Manage your store configuration'}
          </p>
        </div>

        {/* Delivery Pricing */}
        <div className="bg-white rounded-2xl p-8 mb-6">
          <h2 className="text-2xl text-brand-black mb-6 flex items-center">
            <Truck className="w-6 h-6 mr-2 text-brand-orange" />
            Delivery Pricing
          </h2>

          <div className="space-y-6">
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Local Delivery</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (R)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.local}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, local: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Radius (km)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.localRadius}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, localRadius: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Current: R{deliveryPricing.local} for deliveries within {deliveryPricing.localRadius}km
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Medium Distance</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (R)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.medium}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, medium: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Radius (km)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.mediumRadius}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, mediumRadius: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Current: R{deliveryPricing.medium} for deliveries within {deliveryPricing.mediumRadius}km
              </p>
            </div>

            <div className="pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Far Distance</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (R)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.far}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, far: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Radius (km)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deliveryPricing.farRadius}
                    onChange={(e) =>
                      setDeliveryPricing({ ...deliveryPricing, farRadius: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Current: R{deliveryPricing.far} for deliveries within {deliveryPricing.farRadius}km
              </p>
            </div>

            <button
              onClick={handleSaveDelivery}
              disabled={loading}
              className="btn-primary flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Saving...' : 'Save Delivery Pricing'}</span>
            </button>
          </div>
        </div>

        {/* Store Location */}
        <div className="bg-white rounded-2xl p-8">
          <h2 className="text-2xl text-brand-black mb-6">Store Location</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                className="input-field"
                value={storeLocation.address}
                onChange={(e) => setStoreLocation({ ...storeLocation, address: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input-field"
                  value={storeLocation.lat}
                  onChange={(e) =>
                    setStoreLocation({ ...storeLocation, lat: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input-field"
                  value={storeLocation.lng}
                  onChange={(e) =>
                    setStoreLocation({ ...storeLocation, lng: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <p className="text-sm text-gray-600">
              This location is used to calculate delivery distances and fees.
            </p>
          </div>

          <button
            onClick={handleSaveLocation}
            disabled={loading}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? 'Saving...' : 'Save Store Location'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}