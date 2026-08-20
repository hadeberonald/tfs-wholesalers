import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore, type Branch } from '@/lib/store';
import api from '@/lib/api';
import { getIconKeyForBranchSlug } from '@/lib/branch-icon-map';
import { switchAppIcon, getCurrentAppIcon } from '@/lib/icon-switcher';

/**
 * Dev-only branch switcher. Lets you preview each branch's in-app logo,
 * header, and (on a real device build, not Expo Go) home-screen icon
 * without needing to physically be near that branch or spoof GPS.
 *
 * Not linked from any production nav - open it manually while developing,
 * e.g. by typing the route or adding a temporary button. Everything here
 * is gated on __DEV__ so it can't ship live even if someone stumbles onto
 * the route in a release build.
 */
export default function DebugBranches() {
  const router = useRouter();
  const currentBranch = useStore((state) => state.branch);
  const setBranch = useStore((state) => state.setBranch);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const [currentIcon, setCurrentIcon] = useState<string | null>('…');

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/(tabs)');
      return;
    }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [branchesRes, icon] = await Promise.all([
        api.get('/api/mobile/branches'),
        getCurrentAppIcon(),
      ]);
      setBranches(branchesRes.data?.branches ?? []);
      setCurrentIcon(icon ?? 'default');
    } catch (err) {
      console.error('[DEBUG BRANCHES] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const previewBranch = async (branch: Branch) => {
    setSwitchingSlug(branch.slug);
    try {
      // Store update only - lets you see the header/logo change instantly
      // without waiting on the (possibly process-killing) icon switch.
      setBranch(branch);

      const iconKey = getIconKeyForBranchSlug(branch.slug);
      // Fire the icon switch after a tick so this screen has already
      // re-rendered with the new branch before Android potentially kills
      // the process to apply it - same ordering used in index.tsx.
      setTimeout(() => {
        switchAppIcon(iconKey)
          .then(() => getCurrentAppIcon())
          .then(setCurrentIcon)
          .catch((err) => console.error('[DEBUG BRANCHES] Icon switch failed:', err));
      }, 200);
    } finally {
      setSwitchingSlug(null);
    }
  };

  if (!__DEV__) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug: Branch Switcher</Text>
      <Text style={styles.subtitle}>
        Current branch: {currentBranch?.slug ?? 'none'} · Current icon: {currentIcon}
      </Text>
      <Text style={styles.warning}>
        Dev only. On a real device build, tapping a branch may trigger an actual icon
        change (and on Android, a process relaunch) - that's expected here, not a bug.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {branches.map((branch) => (
            <TouchableOpacity
              key={branch.slug}
              style={[
                styles.row,
                currentBranch?.slug === branch.slug && styles.rowActive,
              ]}
              onPress={() => previewBranch(branch)}
              disabled={switchingSlug === branch.slug}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{branch.displayName}</Text>
                <Text style={styles.rowSlug}>{branch.slug} · {branch.status}</Text>
              </View>
              {switchingSlug === branch.slug && <ActivityIndicator size="small" color="#FF6B35" />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.row}
            onPress={() => previewBranch({ slug: 'wholesalers', displayName: 'Default', status: 'active', name: 'default' } as Branch)}
          >
            <Text style={styles.rowTitle}>Reset to default</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  warning: { fontSize: 12, color: '#ef4444', marginTop: 10, marginBottom: 16, lineHeight: 17 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowActive: { backgroundColor: '#fef3e9' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  rowSlug: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  doneButton: {
    backgroundColor: '#FF6B35', paddingVertical: 14, borderRadius: 8,
    alignItems: 'center', marginTop: 12,
  },
  doneButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});