import { useCallback, useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import {
  locateNearestBranch,
  getCachedBranchSlug,
  getLastResolutionDebug,
  BranchLocationError,
  type BranchWithLocation,
  type ResolutionDebug,
} from '@/lib/branchLocation';
import { getIconKeyForBranchSlug } from '@/lib/branch-icon-map';
import { switchAppIcon } from '@/lib/icon-switcher';
// useOnboardingIconDetection() REMOVED — it duplicated resolveBranch()'s
// job (location -> branch fetch -> nearest match -> switchAppIcon) and ran
// concurrently with it on every cold start. Two simultaneous native
// icon-switch calls racing each other was the actual crash: overlapping
// writes to Android's component-enabled state, not just the expected
// single process relaunch. resolveBranch() below already covers first-run
// detection on every launch, so this hook has no job left to do.

type Phase = 'locating' | 'error';

export default function Index() {
  const router = useRouter();
  const setBranch = useStore((state) => state.setBranch);
  const [phase, setPhase] = useState<Phase>('locating');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [debug, setDebug] = useState<ResolutionDebug | null>(null);

  useEffect(() => {
    resolveBranch();
  }, []);

  const applyBranch = async (branch: BranchWithLocation) => {
    setBranch(branch);
    // Same guard rails as before (no-ops in Expo Go, skips redundant native
    // calls) — just triggered by location resolution instead of a manual tap.
    const iconKey = getIconKeyForBranchSlug(branch.slug);
    await switchAppIcon(iconKey);
    router.replace('/(tabs)');
  };

  const resolveBranch = useCallback(async () => {
    setPhase('locating');
    setErrorCode(null);
    setDebug(null);
    try {
      const branch = await locateNearestBranch();
      setDebug(getLastResolutionDebug());
      await applyBranch(branch);
    } catch (err) {
      if (err instanceof BranchLocationError) {
        // Transient failures (no GPS fix, flaky network) fall back to the
        // last branch we successfully resolved, so a bad signal doesn't
        // fully block a returning user.
        if (err.code === 'NETWORK_ERROR' || err.code === 'LOCATION_UNAVAILABLE') {
          const cachedSlug = await getCachedBranchSlug();
          if (cachedSlug) {
            try {
              const res = await api.get(`/api/mobile/branches/${cachedSlug}`);
              if (res.data?.success && res.data?.branch) {
                await applyBranch(res.data.branch);
                return;
              }
            } catch {
              // fall through to error screen below
            }
          }
        }
        setErrorCode(err.code);
        setPhase('error');
      } else {
        setErrorCode('UNKNOWN');
        setPhase('error');
      }
    }
  }, []);

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.errorTitle}>{errorTitle(errorCode)}</Text>
        <Text style={styles.errorSubtitle}>{errorSubtitle(errorCode)}</Text>

        {errorCode === 'PERMISSION_DENIED' && (
          <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.retryButton} onPress={resolveBranch}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>

        {__DEV__ && <DebugTable debug={debug ?? getLastResolutionDebug()} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />
      <Text style={styles.statusText}>Finding your nearest branch…</Text>
    </View>
  );
}

// Dev-only table showing exactly what the server saw: your coords, the
// radius it applied, every candidate branch's distance, and which one was
// assigned. Only renders in __DEV__ builds — never ships to real users.
function DebugTable({ debug }: { debug: ResolutionDebug | null }) {
  if (!debug) return null;
  return (
    <View style={debugStyles.wrap}>
      <Text style={debugStyles.heading}>Debug: branch resolution</Text>
      <Text style={debugStyles.meta}>
        You: {debug.userLat.toFixed(5)}, {debug.userLng.toFixed(5)}
      </Text>
      <Text style={debugStyles.meta}>
        Radius: {debug.radiusKm}km · Assigned: {debug.assignedSlug} (
        {debug.assignedDistanceKm.toFixed(2)}km){debug.withinRadius ? '' : ' — outside radius, used nearest anyway'}
      </Text>
      {debug.candidates ? (
        debug.candidates.map((c) => (
          <View key={c.slug} style={debugStyles.row}>
            <Text style={[debugStyles.cell, !c.withinRadius && debugStyles.outOfRadius]} numberOfLines={1}>
              {c.displayName} ({c.slug})
            </Text>
            <Text style={[debugStyles.cell, !c.withinRadius && debugStyles.outOfRadius]}>
              {c.distanceKm === Infinity ? 'no location' : `${c.distanceKm.toFixed(2)} km`}
            </Text>
          </View>
        ))
      ) : (
        <Text style={debugStyles.meta}>(candidate list not fetched — pass debug=true)</Text>
      )}
    </View>
  );
}

function errorTitle(code: string | null) {
  switch (code) {
    case 'PERMISSION_DENIED': return 'Location access needed';
    case 'LOCATION_UNAVAILABLE': return "Couldn't find your location";
    case 'NO_BRANCHES': return 'No branches available';
    case 'NETWORK_ERROR': return "Couldn't connect";
    default: return 'Something went wrong';
  }
}

function errorSubtitle(code: string | null) {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'We use your location to find your nearest TFS Wholesalers branch. Please enable location access in Settings and try again.';
    case 'LOCATION_UNAVAILABLE':
      return 'Make sure location services are turned on, then try again.';
    case 'NO_BRANCHES':
      return "We couldn't find a branch near you. Please check back later.";
    case 'NETWORK_ERROR':
      return 'Check your internet connection and try again.';
    default:
      return 'Please try again.';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: { width: 220, height: 100 },
  loader: { marginTop: 40 },
  statusText: { marginTop: 16, fontSize: 14, color: '#6b7280' },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  retryButtonText: { color: '#1f2937', fontSize: 16, fontWeight: '600' },
});

const debugStyles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
  heading: { fontSize: 12, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  meta: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  cell: { fontSize: 11, color: '#1f2937', flexShrink: 1 },
  outOfRadius: { color: '#ef4444' },
});