import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/lib/api';
import { findNearestWithinRadius } from '@/lib/geo';
import { getIconKeyForBranchSlug, DEFAULT_ICON_KEY, DEFAULT_RADIUS_KM } from '@/lib/branch-icon-map';
import { switchAppIcon } from '@/lib/icon-switcher';

// Bump the version suffix if you ever need to force re-detection for
// everyone (e.g. after adding a new branch) - otherwise leave it alone.
const ONBOARDING_FLAG_KEY = 'tfs_onboarding_icon_detection_complete_v1';

interface BranchWithLocation {
  slug: string;
  latitude: number;
  longitude: number;
}

/**
 * Call this ONCE, from the first screen a new user hits (currently
 * branch-select). It:
 *   1. Checks whether detection has already run - if so, does nothing.
 *   2. Requests foreground location permission.
 *   3. Fetches live branches from /api/mobile/branches and reads each
 *      branch's real settings.storeLocation.lat / .lng.
 *   4. Resolves the nearest branch within DEFAULT_RADIUS_KM.
 *   5. Sets the icon accordingly, falling back to DEFAULT_ICON_KEY (null -
 *      the neutral TFS Wholesalers icon) if nothing matches.
 *   6. Marks detection as complete so this never runs again automatically.
 *
 * This is the one expected icon-change alert on iOS - it happens on first
 * launch, so the user isn't surprised by it later.
 */
export function useOnboardingIconDetection() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runDetection();
  }, []);

  async function runDetection() {
    let alreadyRun: string | null = null;

    try {
      alreadyRun = await AsyncStorage.getItem(ONBOARDING_FLAG_KEY);
    } catch (err) {
      console.error('[ONBOARDING ICON] Failed to read flag, proceeding anyway:', err);
    }

    if (alreadyRun === 'true') {
      console.log('[ONBOARDING ICON] Detection already ran once - skipping');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.log('[ONBOARDING ICON] Permission denied - using default icon');
        await switchAppIcon(DEFAULT_ICON_KEY);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await api.get('/api/mobile/branches');
      const rawBranches: any[] = response.data?.branches ?? [];

      const candidates: BranchWithLocation[] = rawBranches
        .filter(
          (b) =>
            b.status === 'active' &&
            typeof b.settings?.storeLocation?.lat === 'number' &&
            typeof b.settings?.storeLocation?.lng === 'number'
        )
        .map((b) => ({
          slug: b.slug,
          latitude: b.settings.storeLocation.lat,
          longitude: b.settings.storeLocation.lng,
        }));

      const match = findNearestWithinRadius(
        { latitude: position.coords.latitude, longitude: position.coords.longitude },
        candidates,
        DEFAULT_RADIUS_KM
      );

      if (match) {
        console.log('[ONBOARDING ICON] Nearest branch:', match.slug);
        await switchAppIcon(getIconKeyForBranchSlug(match.slug));
      } else {
        console.log('[ONBOARDING ICON] Outside all branch radii - using default icon');
        await switchAppIcon(DEFAULT_ICON_KEY);
      }
    } catch (err) {
      console.error('[ONBOARDING ICON] Detection failed, falling back to default:', err);
      await switchAppIcon(DEFAULT_ICON_KEY);
    } finally {
      try {
        await AsyncStorage.setItem(ONBOARDING_FLAG_KEY, 'true');
      } catch (err) {
        console.error('[ONBOARDING ICON] Failed to persist flag:', err);
      }
    }
  }
}