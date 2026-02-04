'use client';

import { useEffect, useRef, useState } from 'react';

interface LocationPickerProps {
  onLocationSelect: (data: {
    lat: number;
    lng: number;
    address: string;
    distance: number;
    deliveryFee: number;
  }) => void;
  storeLocation: { lat: number; lng: number };
  deliverySettings: {
    local: number;
    localRadius: number;
    medium: number;
    mediumRadius: number;
    far: number;
    farRadius: number;
  };
}

export default function AddressMapPicker({
  onLocationSelect,
  storeLocation,
  deliverySettings,
}: LocationPickerProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isInRange, setIsInRange] = useState(false);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate delivery fee based on distance
  const getDeliveryFee = (distanceKm: number): number => {
    if (distanceKm <= deliverySettings.localRadius) {
      return deliverySettings.local;
    } else if (distanceKm <= deliverySettings.mediumRadius) {
      return deliverySettings.medium;
    } else if (distanceKm <= deliverySettings.farRadius) {
      return deliverySettings.far;
    }
    return deliverySettings.far;
  };

  // Reverse geocode using Nominatim (OpenStreetMap)
  const reverseGeocode = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TFS-Wholesalers/1.0',
          },
        }
      );
      const data = await response.json();

      if (data && data.display_name) {
        const formattedAddress = data.display_name;
        setAddress(formattedAddress);

        const dist = calculateDistance(storeLocation.lat, storeLocation.lng, lat, lng);
        const fee = getDeliveryFee(dist);
        const inRange = dist <= deliverySettings.farRadius;

        setDistance(dist);
        setDeliveryFee(fee);
        setIsInRange(inRange);

        onLocationSelect({
          lat,
          lng,
          address: formattedAddress,
          distance: dist,
          deliveryFee: fee,
        });
      } else {
        setAddress('Address not found - please verify location');
        const dist = calculateDistance(storeLocation.lat, storeLocation.lng, lat, lng);
        const fee = getDeliveryFee(dist);
        const inRange = dist <= deliverySettings.farRadius;

        setDistance(dist);
        setDeliveryFee(fee);
        setIsInRange(inRange);

        onLocationSelect({
          lat,
          lng,
          address: 'Selected location on map',
          distance: dist,
          deliveryFee: fee,
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setAddress('Location selected - please verify address below');
      
      const dist = calculateDistance(storeLocation.lat, storeLocation.lng, lat, lng);
      const fee = getDeliveryFee(dist);
      const inRange = dist <= deliverySettings.farRadius;

      setDistance(dist);
      setDeliveryFee(fee);
      setIsInRange(inRange);

      onLocationSelect({
        lat,
        lng,
        address: 'Selected location',
        distance: dist,
        deliveryFee: fee,
      });
    } finally {
      setLoading(false);
    }
  };

  // Load Leaflet
  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;

    script.onload = () => {
      setMapLoaded(true);
    };

    document.body.appendChild(script);

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || mapRef.current) return;

    // @ts-ignore
    const L = window.L;
    if (!L) return;

    // Initialize map centered on store
    const map = L.map('delivery-map').setView([storeLocation.lat, storeLocation.lng], 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Store location marker (blue)
    const storeIcon = L.divIcon({
      className: 'custom-store-marker',
      html: `
        <div style="position: relative;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#3B82F6" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="white"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([storeLocation.lat, storeLocation.lng], { icon: storeIcon })
      .addTo(map)
      .bindPopup('<strong>Store Location</strong>');

    // Delivery range circles
    const localCircle = L.circle([storeLocation.lat, storeLocation.lng], {
      radius: deliverySettings.localRadius * 1000,
      color: '#10B981',
      fillColor: '#10B981',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    const mediumCircle = L.circle([storeLocation.lat, storeLocation.lng], {
      radius: deliverySettings.mediumRadius * 1000,
      color: '#F59E0B',
      fillColor: '#F59E0B',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    const farCircle = L.circle([storeLocation.lat, storeLocation.lng], {
      radius: deliverySettings.farRadius * 1000,
      color: '#EF4444',
      fillColor: '#EF4444',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    circlesRef.current = [localCircle, mediumCircle, farCircle];

    // Delivery location marker (orange - draggable)
    const deliveryIcon = L.divIcon({
      className: 'custom-delivery-marker',
      html: `
        <div style="position: relative;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#FF6B35" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    const marker = L.marker([storeLocation.lat, storeLocation.lng], {
      icon: deliveryIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', function (e: any) {
      const position = e.target.getLatLng();
      setSelectedLocation({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng);
    });

    // Click to place marker
    map.on('click', function (e: any) {
      marker.setLatLng(e.latlng);
      setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Create info box using L.Control.extend
    const InfoControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function () {
        const div = L.DomUtil.create('div', 'info-box');
        div.innerHTML = `
          <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-family: sans-serif; max-width: 220px;">
            <div style="font-weight: bold; margin-bottom: 8px; color: #1a1a1a; font-size: 14px;">📍 Select Delivery Location</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Click on map or drag the orange marker</div>
            <div style="border-top: 1px solid #e5e5e5; padding-top: 8px; margin-top: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #10B981;"></div>
                <span style="font-size: 11px; color: #666;">Local (R${deliverySettings.local})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #F59E0B;"></div>
                <span style="font-size: 11px; color: #666;">Medium (R${deliverySettings.medium})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #EF4444;"></div>
                <span style="font-size: 11px; color: #666;">Far (R${deliverySettings.far})</span>
              </div>
            </div>
          </div>
        `;
        return div;
      }
    });

    // Add the control to the map
    new InfoControl().addTo(map);

  }, [mapLoaded, storeLocation, deliverySettings]);

  // Get current location button handler
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (markerRef.current && mapRef.current) {
          // @ts-ignore
          const L = window.L;
          if (L) {
            markerRef.current.setLatLng([lat, lng]);
            mapRef.current.setView([lat, lng], 15);
            setSelectedLocation({ lat, lng });
            reverseGeocode(lat, lng);
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please select manually on the map.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
      {/* Use My Location Button */}
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Use My Current Location</span>
      </button>

      {/* Map */}
      <div className="relative">
        <div
          id="delivery-map"
          className="w-full h-96 rounded-xl border-2 border-gray-300 relative z-0"
          style={{ minHeight: '400px' }}
        >
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-3 mx-auto"></div>
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Address Display */}
      {selectedLocation && (
        <div className={`p-4 rounded-lg border-2 ${isInRange ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600">Loading address...</span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-3">
                <svg className={`w-5 h-5 mt-0.5 ${isInRange ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{address}</p>
                  {distance !== null && (
                    <p className="text-sm text-gray-600 mt-1">
                      Distance: {distance.toFixed(2)} km from store
                    </p>
                  )}
                </div>
              </div>

              {isInRange ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Delivery Fee:</span>
                  <span className="text-lg font-bold text-brand-orange">R{deliveryFee.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-red-100 p-3 rounded-lg">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-800">
                    This location is outside our delivery area (max {deliverySettings.farRadius} km). Please select a closer location.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {!selectedLocation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>How to select your location:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li>Click "Use My Current Location" to auto-detect your address</li>
            <li>Or click anywhere on the map to pin your delivery location</li>
            <li>You can also drag the orange marker to adjust your location</li>
          </ul>
        </div>
      )}
    </div>
  );
}