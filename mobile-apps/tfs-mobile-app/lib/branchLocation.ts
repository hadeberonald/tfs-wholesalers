import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/lib/api';
import type { Branch } from '@/lib/store';
import { DEFAULT_RADIUS_KM } from '@/lib/branch-icon-map';

export type BranchLocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'NO_BRANCHES'
  | 'NETWORK_ERROR';

export interface BranchDistanceInfo {
  slug: string;
  displayName: string;
  distanceKm: number;
  withinRadius: boolean;
  lat: number | null;
  lng: number | null;
}

export interface ResolutionDebug {
  userLat: number;
  userLng: number;
  radiusKm: number;
  assignedSlug: string;
  assignedDistanceKm: number;
  withinRadius: boolean; // was the assigned branch within radiusKm
  candidates: BranchDistanceInfo[] | null; // null unless fetched with debug=true
}

export class BranchLocationError extends Error {
  code: BranchLocationErrorCode;
  constructor(code: BranchLocationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// The nearest-branch API response gets assigned straight into
// useStore().branch, so it must match the store's Branch shape exactly —
// re-exporting rather than maintaining a second, drifting definition.
export type BranchWithLocation = Branch;

const CACHED_SLUG_KEY = 'selectedBranch';
const CACHED_AT_KEY = 'selectedBranchCachedAt';

// Debug info from the most recent successful resolution, so the error/dev
// screen can read it without threading it through every call site.
let lastDebug: ResolutionDebug | null = null;
export function getLastResolutionDebug(): ResolutionDebug | null {
  return lastDebug;
}

/**
 * Requests foreground location permission, reads the device's current
 * position, and asks the server for the closest active branch to that
 * point (GET /api/mobile/branches/nearest). The server always assigns the
 * nearest branch regardless of distance ("clients in the middle" get
 * whichever branch is closest by km) — radiusKm is advisory only and
 * comes back as `withinRadius` so the UI can flag distant assignments
 * without blocking them.
 *
 * Throws BranchLocationError with a code the UI can branch its messaging
 * on (permission denied vs. no GPS fix vs. network failure vs. nothing in
 * the DB at all).
 */
export async function locateNearestBranch(
  radiusKm: number = DEFAULT_RADIUS_KM,
  { debug = __DEV__ }: { debug?: boolean } = {}
): Promise<BranchWithLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new BranchLocationError('PERMISSION_DENIED', 'Location permission was not granted.');
  }

  let position;
  try {
    position = await Location.getCurrentPositionAsync({
      // High rather than Balanced — Balanced can return a stale/cached fix
      // on some Android devices, which is a classic cause of "I'm clearly
      // in town but it thinks I'm 30km away" boundary complaints.
      accuracy: Location.Accuracy.High,
    });
  } catch {
    throw new BranchLocationError('LOCATION_UNAVAILABLE', 'Could not determine your location.');
  }

  const { latitude, longitude } = position.coords;

  let data: any;
  try {
    const response = await api.get('/api/mobile/branches/nearest', {
      params: { lat: latitude, lng: longitude, radiusKm, debug: debug ? 'true' : undefined },
    });
    data = response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      throw new BranchLocationError('NO_BRANCHES', 'No branches with a location were found.');
    }
    throw new BranchLocationError('NETWORK_ERROR', 'Could not reach the server.');
  }

  if (!data?.success || !data?.branch) {
    throw new BranchLocationError('NO_BRANCHES', 'No branches with a location were found.');
  }

  const branch: BranchWithLocation = data.branch;

  lastDebug = {
    userLat: latitude,
    userLng: longitude,
    radiusKm: data.radiusKm ?? radiusKm,
    assignedSlug: branch.slug,
    assignedDistanceKm: data.distanceKm,
    withinRadius: data.withinRadius,
    candidates: Array.isArray(data.candidates) ? data.candidates : null,
  };

  await AsyncStorage.setItem(CACHED_SLUG_KEY, branch.slug);
  await AsyncStorage.setItem(CACHED_AT_KEY, String(Date.now()));

  return branch;
}

/** Last branch slug we successfully resolved, for offline/error fallback only. */
export async function getCachedBranchSlug(): Promise<string | null> {
  return AsyncStorage.getItem(CACHED_SLUG_KEY);
}