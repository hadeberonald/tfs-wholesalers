'use client';

import { useState, useEffect } from 'react';
import { Settings, Truck, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
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

  const handleSaveDelivery = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryPricing),
      });

      if (res.ok) {
        toast.success('Delivery pricing updated successfully');
      } else {
        toast.error('Failed to update delivery pricing');
      }
    } catch (error) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeLocation),
      });

      if (res.ok) {
        toast.success('Store location updated successfully');
      } else {
        toast.error('Failed to update store location');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-brand-black mb-2 flex items-center">
            <Settings className="w-10 h-10 mr-3 text-brand-orange" />
            Settings
          </h1>
          <p className="text-gray-600">Manage your store configuration</p>
        </div>

        {/* Delivery Pricing Section */}
        <div className="bg-white rounded-2xl p-8 mb-6">
          <h2 className="font-display text-2xl text-brand-black mb-6 flex items-center">
            <Truck className="w-6 h-6 mr-2 text-brand-orange" />
            Delivery Pricing
          </h2>

          <div className="space-y-6">
            {/* Local Delivery */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Local Delivery</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (R)
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Radius (km)
                  </label>
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

            {/* Medium Distance */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Medium Distance</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (R)
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Radius (km)
                  </label>
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

            {/* Far Distance */}
            <div className="pb-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Far Distance</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (R)
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Radius (km)
                  </label>
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

        {/* Store Location Section */}
        <div className="bg-white rounded-2xl p-8">
          <h2 className="font-display text-2xl text-brand-black mb-6">Store Location</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                className="input-field"
                value={storeLocation.address}
                onChange={(e) =>
                  setStoreLocation({ ...storeLocation, address: e.target.value })
                }
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
