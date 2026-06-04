// app/address-picker.tsx

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Animated, Keyboard, ScrollView, Modal,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Navigation, Search, X, ChevronLeft, Check, Truck, XCircle } from 'lucide-react-native';
import { useStore } from '@/lib/store';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DeliveryAddress {
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  deliveryFee: number;
  distance: number;
  outsideZone: boolean;
}

export interface DeliverySettings {
  local: number;
  localRadius: number;
  medium: number;
  mediumRadius: number;
  far: number;
  farRadius: number;
}

interface SearchSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

const DEFAULT_STORE: { lat: number; lng: number } = {
  lat: -27.763912,
  lng: 30.798969,
};

const DEFAULT_DELIVERY: DeliverySettings = {
  local: 35,
  localRadius: 15,
  medium: 35,
  mediumRadius: 15,
  far: 35,
  farRadius: 15,
};

// ─────────────────────────────────────────────────────────────────────────────
// Distance helper
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Flat R35 for everyone within zone
function calcDelivery(
  distKm: number,
  settings: DeliverySettings,
): { fee: number; outsideZone: boolean } {
  if (distKm <= settings.farRadius) return { fee: 35, outsideZone: false };
  return { fee: 35, outsideZone: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google helpers
// ─────────────────────────────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<Omit<DeliveryAddress, 'deliveryFee' | 'distance' | 'outsideZone'> | null> {
  if (!KEY) return null;
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${KEY}&region=za&language=en`,
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    const r     = data.results[0];
    const comps: any[] = r.address_components;
    const get   = (t: string) => comps.find((c: any) => c.types.includes(t))?.long_name ?? '';

    const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
    const suburb = get('sublocality_level_1') || get('sublocality') || get('neighborhood');

    return {
      name:             street || suburb || get('locality') || 'Selected Location',
      street,
      city:             get('locality') || get('administrative_area_level_2'),
      province:         get('administrative_area_level_1'),
      postalCode:       get('postal_code'),
      country:          get('country') || 'South Africa',
      lat, lng,
      formattedAddress: r.formatted_address,
    };
  } catch { return null; }
}

async function getPlaceSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!KEY || query.length < 3) return [];
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:za&key=${KEY}&types=address&language=en`,
    );
    const data = await res.json();
    return (data.predictions ?? []).map((p: any) => ({
      place_id:       p.place_id,
      description:    p.description,
      main_text:      p.structured_formatting?.main_text      ?? p.description,
      secondary_text: p.structured_formatting?.secondary_text ?? '',
    }));
  } catch { return []; }
}

async function placeIdToCoords(placeId: string): Promise<{ lat: number; lng: number } | null> {
  if (!KEY) return null;
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${KEY}`,
    );
    const data = await res.json();
    const loc  = data.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch { return null; }
}

function fallbackAddress(lat: number, lng: number): Omit<DeliveryAddress, 'deliveryFee' | 'distance' | 'outsideZone'> {
  return {
    name: 'Pin Location', street: '', city: '', province: '',
    postalCode: '', country: 'South Africa', lat, lng,
    formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Out-of-range modal
// ─────────────────────────────────────────────────────────────────────────────
function OutOfRangeModal({
  visible,
  distance,
  maxRadius,
  onClose,
}: {
  visible: boolean;
  distance: number;
  maxRadius: number;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconWrap}>
            <XCircle color="#ef4444" size={44} />
          </View>
          <Text style={styles.modalTitle}>Outside Delivery Zone</Text>
          <Text style={styles.modalBody}>
            This address is{' '}
            <Text style={styles.modalHighlight}>{distance.toFixed(1)} km</Text> away
            from our store. We currently only deliver within{' '}
            <Text style={styles.modalHighlight}>{maxRadius} km</Text>.
          </Text>
          <Text style={styles.modalSub}>
            Please move the pin to a closer location to continue.
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>Choose a Different Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AddressPickerScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const branch  = useStore((s) => s.branch);
  const setPendingDeliveryAddress = useStore((s) => s.setPendingDeliveryAddress);

  const storeLocation: { lat: number; lng: number } = {
    lat: branch?.settings?.storeLocation?.lat ?? DEFAULT_STORE.lat,
    lng: branch?.settings?.storeLocation?.lng ?? DEFAULT_STORE.lng,
  };

  const deliverySettings: DeliverySettings = {
    local:        35,
    localRadius:  (branch?.settings as any)?.deliveryPricing?.localRadius  ?? DEFAULT_DELIVERY.localRadius,
    medium:       35,
    mediumRadius: (branch?.settings as any)?.deliveryPricing?.mediumRadius ?? DEFAULT_DELIVERY.mediumRadius,
    far:          35,
    farRadius:    (branch?.settings as any)?.deliveryPricing?.farRadius    ?? DEFAULT_DELIVERY.farRadius,
  };

  const initialRegion: Region = {
    latitude:      storeLocation.lat,
    longitude:     storeLocation.lng,
    latitudeDelta:  0.05,
    longitudeDelta: 0.05,
  };

  const [address, setAddress]                 = useState<DeliveryAddress | null>(null);
  const [geocoding, setGeocoding]             = useState(false);
  const [locating, setLocating]               = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [suggestions, setSuggestions]         = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDragging, setIsDragging]           = useState(false);
  // Show the out-of-range modal when user taps Confirm on an OOZ address
  const [showOutOfRange, setShowOutOfRange]   = useState(false);

  const mapRef      = useRef<MapView>(null);
  const pinAnim     = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress    = useRef(false);
  const reqId       = useRef(0);

  const animatePin = useCallback((dragging: boolean) => {
    Animated.spring(pinAnim, {
      toValue: dragging ? -14 : 0,
      friction: 4, tension: 80, useNativeDriver: true,
    }).start();
  }, [pinAnim]);

  const buildAddress = useCallback(
    (base: Omit<DeliveryAddress, 'deliveryFee' | 'distance' | 'outsideZone'>): DeliveryAddress => {
      const distKm  = haversineKm(storeLocation.lat, storeLocation.lng, base.lat, base.lng);
      const { fee, outsideZone } = calcDelivery(distKm, deliverySettings);
      return { ...base, deliveryFee: fee, distance: parseFloat(distKm.toFixed(2)), outsideZone };
    },
    [storeLocation, deliverySettings],
  );

  const geocode = useCallback(async (lat: number, lng: number) => {
    const id = ++reqId.current;
    setGeocoding(true);
    const result = await reverseGeocode(lat, lng);
    if (reqId.current !== id) return;
    const base = result ?? fallbackAddress(lat, lng);
    const full = buildAddress(base);
    setAddress(full);
    setShowSuggestions((open) => {
      if (!open) setSearchQuery(full.formattedAddress);
      return open;
    });
    setGeocoding(false);
  }, [buildAddress]);

  const flyTo = useCallback((lat: number, lng: number, delta = 0.008) => {
    suppress.current = true;
    const r: Region = { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
    mapRef.current?.animateToRegion(r, 600);
    geocode(lat, lng);
    setTimeout(() => { suppress.current = false; }, 1200);
  }, [geocode]);

  const onRegionChange = useCallback(() => {
    if (!suppress.current) {
      setIsDragging(true);
      animatePin(true);
    }
  }, [animatePin]);

  const onRegionChangeComplete = useCallback((r: Region) => {
    setIsDragging(false);
    animatePin(false);
    if (suppress.current) return;
    geocode(r.latitude, r.longitude);
  }, [geocode, animatePin]);

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access in your device Settings, or search for your address manually.',
          [{ text: 'OK' }],
        );
        return;
      }

      let loc: Location.LocationObject | null = null;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]) as Location.LocationObject;
      } catch {
        try {
          loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
          ]) as Location.LocationObject;
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
      }

      if (!loc) {
        Alert.alert(
          'Location Unavailable',
          'Could not get your location. Please search for your delivery address instead.',
          [{ text: 'OK' }],
        );
        return;
      }

      flyTo(loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert(
        'Location Error',
        'Something went wrong. Please search for your delivery address instead.',
        [{ text: 'OK' }],
      );
    } finally {
      setLocating(false);
    }
  }, [flyTo]);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await getPlaceSuggestions(text);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
  };

  const onSelectSuggestion = async (s: SearchSuggestion) => {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSearchQuery(s.description);
    const coords = await placeIdToCoords(s.place_id);
    if (coords) flyTo(coords.lat, coords.lng);
  };

  const onConfirm = () => {
    if (!address) return;

    // Show the modal instead of an Alert — keeps UX consistent with checkout
    if (address.outsideZone) {
      setShowOutOfRange(true);
      return;
    }

    suppress.current = true;
    Keyboard.dismiss();
    setPendingDeliveryAddress(address);
    router.back();
  };

  const deliveryLabel = () => {
    if (!address) return null;
    if (address.outsideZone) {
      return (
        <View style={[styles.feeRow, styles.feeRowError]}>
          <Text style={styles.feeTextError}>
            ⚠️ {address.distance.toFixed(1)} km – outside delivery zone ({deliverySettings.farRadius} km max)
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.feeRow}>
        <Truck color="#FF6B35" size={14} />
        <Text style={styles.feeText}>
          {address.distance.toFixed(1)} km away · Delivery fee:{' '}
          <Text style={styles.feeAmount}>R{address.deliveryFee.toFixed(2)}</Text>
        </Text>
      </View>
    );
  };

  const topBarTop  = insets.top + 12;
  const suggestTop = insets.top + 72;
  const bottomPad  = insets.bottom + 16;

  return (
    <View style={styles.container}>
      {/* Out-of-range modal — shown when user tries to confirm an OOZ address */}
      <OutOfRangeModal
        visible={showOutOfRange}
        distance={address?.distance ?? 0}
        maxRadius={deliverySettings.farRadius}
        onClose={() => setShowOutOfRange(false)}
      />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      />

      {/* Centred pin */}
      <View style={styles.pinWrapper} pointerEvents="none">
        <Animated.View style={[styles.pinContainer, { transform: [{ translateY: pinAnim }] }]}>
          <View style={[styles.pinHead, address?.outsideZone && styles.pinHeadError]}>
            <MapPin color="#fff" size={20} fill={address?.outsideZone ? '#ef4444' : '#FF6B35'} />
          </View>
          <View style={[styles.pinTail, address?.outsideZone && styles.pinTailError]} />
        </Animated.View>
        <Animated.View style={[styles.pinShadow, {
          opacity:   pinAnim.interpolate({ inputRange: [-14, 0], outputRange: [0.3, 0.7] }),
          transform: [{ scaleX: pinAnim.interpolate({ inputRange: [-14, 0], outputRange: [1.4, 1] }) }],
        }]} />
      </View>

      {/* Search bar */}
      <View style={[styles.topBar, { top: topBarTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={18} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your delivery address…"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => { if (searchQuery.length > 2 && suggestions.length > 0) setShowSuggestions(true); }}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
              style={styles.clearBtn}
            >
              <X color="#9ca3af" size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestions, { top: suggestTop }]}>
          <ScrollView keyboardShouldPersistTaps="always" bounces={false}>
            {suggestions.map((s) => (
              <TouchableOpacity key={s.place_id} style={styles.suggRow} onPress={() => onSelectSuggestion(s)}>
                <MapPin color="#FF6B35" size={16} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggMain} numberOfLines={1}>{s.main_text}</Text>
                  <Text style={styles.suggSub}  numberOfLines={1}>{s.secondary_text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Floating locate button */}
      <TouchableOpacity
        style={styles.floatingLocateBtn}
        onPress={handleUseMyLocation}
        disabled={locating}
      >
        {locating
          ? <ActivityIndicator size="small" color="#FF6B35" />
          : <Navigation color="#FF6B35" size={20} />}
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
        <View style={styles.pill} />
        <Text style={styles.sheetLabel}>Delivery Location</Text>

        {geocoding && !address ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#FF6B35" />
            <Text style={styles.loadingText}>Finding address…</Text>
          </View>
        ) : address ? (
          <>
            <View style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <MapPin color="#FF6B35" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addrPrimary} numberOfLines={1}>
                  {address.street || address.name}
                </Text>
                <Text style={styles.addrSecondary} numberOfLines={2}>
                  {[address.city, address.province, address.postalCode].filter(Boolean).join(', ')}
                </Text>
                {geocoding && <Text style={styles.updatingText}>Updating…</Text>}
              </View>
            </View>
            {deliveryLabel()}
          </>
        ) : (
          <Text style={styles.hint}>
            Drag the map or search above to set your delivery address
          </Text>
        )}

        <TouchableOpacity
          style={styles.useLocationBtn}
          onPress={handleUseMyLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <Navigation color="#FF6B35" size={16} />
          )}
          <Text style={styles.useLocationText}>
            {locating ? 'Getting location…' : 'Use My Location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (!address || address.outsideZone) && styles.confirmDisabled,
          ]}
          onPress={onConfirm}
          disabled={!address}
          activeOpacity={0.85}
        >
          <Check color="#fff" size={20} />
          <Text style={styles.confirmText}>
            {address?.outsideZone ? 'Outside Delivery Zone' : 'Confirm Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  pinWrapper: {
    position: 'absolute', top: '50%', left: '50%',
    alignItems: 'center', marginLeft: -20, marginTop: -52,
  },
  pinContainer: { alignItems: 'center' },
  pinHead: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6B35',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B35', shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  pinHeadError: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  pinTail:      { width: 3, height: 14, backgroundColor: '#FF6B35', borderRadius: 2 },
  pinTailError: { backgroundColor: '#ef4444' },
  pinShadow:    { width: 18, height: 6, borderRadius: 50, backgroundColor: '#000', marginTop: 1 },

  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, height: 48,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1f2937', paddingVertical: 0, paddingLeft: 8 },
  clearBtn:    { padding: 12 },

  suggestions: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 14, maxHeight: 240,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, elevation: 6, overflow: 'hidden',
  },
  suggRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  suggMain: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  suggSub:  { fontSize: 12, color: '#6b7280', marginTop: 1 },

  floatingLocateBtn: {
    position: 'absolute', right: 16, bottom: 380,
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 16,
  },
  pill:       { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 18 },
  sheetLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  loadingRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText:  { color: '#6b7280', fontSize: 14 },
  updatingText: { fontSize: 11, color: '#FF6B35', marginTop: 3 },

  addressCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#fff7f3', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 10,
  },
  addressIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fed7aa',
  },
  addrPrimary:   { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  addrSecondary: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  feeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff7f3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 12,
  },
  feeRowError:  { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  feeText:      { fontSize: 13, color: '#92400e' },
  feeTextError: { fontSize: 13, color: '#b91c1c', fontWeight: '600' },
  feeAmount:    { fontWeight: '700', color: '#FF6B35' },

  hint: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 16, paddingVertical: 8 },

  useLocationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 12,
    backgroundColor: '#fff7f3',
  },
  useLocationText: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },

  confirmBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  confirmDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  confirmText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Out-of-range modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
  },
  modalIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  modalTitle:     { fontSize: 20, fontWeight: '800', color: '#1f2937', marginBottom: 10, textAlign: 'center' },
  modalBody:      { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  modalHighlight: { fontWeight: '700', color: '#ef4444' },
  modalSub:       { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14, height: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%',
    shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});