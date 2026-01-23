'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Crosshair, AlertCircle, CheckCircle, Search, Loader2, X } from 'lucide-react';

// Dynamically import map components (Leaflet doesn't work with SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

interface AddressMapPickerProps {
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

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map click handler component (must be used inside MapContainer)
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  // Import useMapEvents directly in the component (not dynamically)
  const { useMapEvents } = require('react-leaflet');
  
  useMapEvents({
    click(e: any) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddressMapPicker({
  onLocationSelect,
  storeLocation,
  deliverySettings,
}: AddressMapPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [distance, setDistance] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWithinRange, setIsWithinRange] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Search addresses as user types
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      setShowResults(true);
      
      try {
        // Search within South Africa, prioritizing KwaZulu-Natal
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&` +
          `countrycodes=za&` +
          `format=json&` +
          `limit=5&` +
          `addressdetails=1`
        );
        
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    setSearchQuery(result.display_name);
    setShowResults(false);
    handleLocationChange(lat, lng);
  };

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        handleLocationChange(latitude, longitude);
        setLoading(false);
      },
      (error) => {
        setError('Unable to get your location. GPS might be inaccurate. Please search for your address instead.');
        setLoading(false);
        setShowMap(true); // Show map as fallback
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleLocationChange = useCallback(async (lat: number, lng: number) => {
    setPosition({ lat, lng });

    // Calculate distance from store
    const dist = calculateDistance(storeLocation.lat, storeLocation.lng, lat, lng);
    setDistance(dist);

    // Check if within service area (60km)
    if (dist > 60) {
      setIsWithinRange(false);
      setError('Sorry, this location is outside our 60km delivery range.');
      return;
    } else {
      setIsWithinRange(true);
      setError('');
    }

    // Calculate delivery fee based on distance
    let fee = deliverySettings.far;
    if (dist <= deliverySettings.localRadius) {
      fee = deliverySettings.local;
    } else if (dist <= deliverySettings.mediumRadius) {
      fee = deliverySettings.medium;
    }
    setDeliveryFee(fee);

    // Reverse geocode to get address (only if we don't have one from search)
    if (!searchQuery || searchQuery.length < 3) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        );
        const data = await response.json();
        const formattedAddress = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setAddress(formattedAddress);
        setSearchQuery(formattedAddress);
      } catch (error) {
        console.error('Geocoding error:', error);
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } else {
      setAddress(searchQuery);
    }

    // Send data to parent
    onLocationSelect({
      lat,
      lng,
      address: searchQuery || address,
      distance: dist,
      deliveryFee: fee,
    });
  }, [storeLocation, deliverySettings, onLocationSelect, searchQuery, address]);

  useEffect(() => {
    // Set default position to store location
    setPosition(storeLocation);
  }, [storeLocation]);

  return (
    <div className="space-y-4">
      {/* Address Search Bar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search for your address *
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="input-field pl-10 pr-10"
            placeholder="Type your street address, suburb, or town (e.g., 'Vryheid', 'Nquthu', 'Blood River')"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            </div>
          )}
          {searchQuery && !searching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => selectSearchResult(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.display_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {result.display_name}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && searchQuery.length >= 3 && searchResults.length === 0 && !searching && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <p className="text-sm text-gray-500">No addresses found. Try a different search or use the map below.</p>
          </div>
        )}
      </div>

      {/* Alternative Options */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={loading}
          className="flex items-center space-x-2 text-sm text-brand-orange hover:text-orange-600 font-medium"
        >
          <Crosshair className="w-4 h-4" />
          <span>{loading ? 'Getting location...' : 'Use GPS Location'}</span>
        </button>
        <span className="text-gray-400">|</span>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className="flex items-center space-x-2 text-sm text-brand-orange hover:text-orange-600 font-medium"
        >
          <MapPin className="w-4 h-4" />
          <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
        </button>
      </div>

      {/* Map (shown on demand or as fallback) */}
      {showMap && position && (
        <div className="relative h-80 rounded-xl overflow-hidden border-2 border-gray-200 mt-4">
          <MapContainer
            center={[position.lat, position.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Store location marker */}
            <Marker position={[storeLocation.lat, storeLocation.lng]} />
            
            {/* Service area circles */}
            <Circle
              center={[storeLocation.lat, storeLocation.lng]}
              radius={deliverySettings.localRadius * 1000}
              pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.1 }}
            />
            <Circle
              center={[storeLocation.lat, storeLocation.lng]}
              radius={deliverySettings.mediumRadius * 1000}
              pathOptions={{ color: 'orange', fillColor: 'orange', fillOpacity: 0.1 }}
            />
            <Circle
              center={[storeLocation.lat, storeLocation.lng]}
              radius={deliverySettings.farRadius * 1000}
              pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }}
            />
            <Circle
              center={[storeLocation.lat, storeLocation.lng]}
              radius={60000}
              pathOptions={{ color: 'gray', fillColor: 'gray', fillOpacity: 0.05, dashArray: '5, 5' }}
            />
            
            {/* Delivery location marker */}
            {position && (
              <Marker
                position={[position.lat, position.lng]}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    handleLocationChange(position.lat, position.lng);
                  },
                }}
              />
            )}
            
            <MapClickHandler onLocationChange={handleLocationChange} />
          </MapContainer>
          
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10 max-w-xs">
            <p className="text-xs text-gray-600 mb-1">Click on map or drag marker to fine-tune location</p>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
              <p className="text-xs font-medium text-gray-900">Store Location</p>
            </div>
          </div>
        </div>
      )}

      {/* Distance and fee info */}
      {position && distance > 0 && (
        <div className={`rounded-lg p-4 ${isWithinRange ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start space-x-3">
            {isWithinRange ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm font-medium ${isWithinRange ? 'text-green-900' : 'text-red-900'}`}>
                  Distance: {distance.toFixed(1)} km from store
                </p>
                {isWithinRange && (
                  <p className="text-lg font-bold text-brand-orange">
                    R{deliveryFee.toFixed(2)}
                  </p>
                )}
              </div>
              {isWithinRange ? (
                <div className="text-xs text-green-700 space-y-1">
                  <p>✓ Within delivery range</p>
                  {distance <= deliverySettings.localRadius && (
                    <p>✓ Local delivery zone (up to {deliverySettings.localRadius}km) - R{deliverySettings.local}</p>
                  )}
                  {distance > deliverySettings.localRadius && distance <= deliverySettings.mediumRadius && (
                    <p>✓ Medium distance zone ({deliverySettings.localRadius}-{deliverySettings.mediumRadius}km) - R{deliverySettings.medium}</p>
                  )}
                  {distance > deliverySettings.mediumRadius && (
                    <p>✓ Far distance zone ({deliverySettings.mediumRadius}-60km) - R{deliverySettings.far}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-red-700">
                  We only deliver within 60km of our store location. Please select a closer address.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && !isWithinRange && (
        <div className="flex items-center space-x-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}