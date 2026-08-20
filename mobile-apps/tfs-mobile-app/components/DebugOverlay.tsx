import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, type Branch } from '@/lib/store';
import api from '@/lib/api';
import { getIconKeyForBranchSlug } from '@/lib/branch-icon-map';
import { switchAppIcon, getCurrentAppIcon } from '@/lib/icon-switcher';
import { getLastResolutionDebug } from '@/lib/branchLocation';

/**
 * Always-mounted debug overlay. No __DEV__ or env-var gating — it renders
 * in every build so it can't get lost in a build-profile mismatch. Sits
 * collapsed as a small tab at the top of the screen; tap to expand.
 *
 * If/when you want this OFF a real production build, the simplest lever
 * is deleting the <DebugOverlay /> line from app/_layout.tsx before that
 * build — no config plumbing required.
 */
export default function DebugOverlay() {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const [currentIcon, setCurrentIcon] = useState<string | null>(null);

  const currentBranch = useStore((state) => state.branch);
  const setBranch = useStore((state) => state.setBranch);
  const resolutionDebug = getLastResolutionDebug();

  useEffect(() => {
    if (expanded && branches.length === 0) load();
  }, [expanded]);

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
      console.error('[DEBUG OVERLAY] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const previewBranch = async (branch: Branch) => {
    setSwitchingSlug(branch.slug);
    setBranch(branch);
    const iconKey = getIconKeyForBranchSlug(branch.slug);
    setTimeout(() => {
      switchAppIcon(iconKey)
        .then(() => getCurrentAppIcon())
        .then((icon) => {
          setCurrentIcon(icon ?? 'default');
          setSwitchingSlug(null);
        })
        .catch((err) => {
          console.error('[DEBUG OVERLAY] Icon switch failed:', err);
          setSwitchingSlug(null);
        });
    }, 200);
  };

  return (
    <View style={[styles.wrap, { top: insets.top }]} pointerEvents="box-none">
      <TouchableOpacity style={styles.tab} onPress={() => setExpanded((e) => !e)}>
        <Text style={styles.tabText}>🐞 DEBUG {expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.sectionTitle}>Current state</Text>
            <Row label="Branch" value={currentBranch?.slug ?? 'none'} />
            <Row label="Icon" value={currentIcon ?? '…'} />

            {resolutionDebug && (
              <>
                <Text style={styles.sectionTitle}>Last resolution</Text>
                <Row label="You" value={`${resolutionDebug.userLat.toFixed(5)}, ${resolutionDebug.userLng.toFixed(5)}`} />
                <Row label="Radius" value={`${resolutionDebug.radiusKm}km`} />
                <Row
                  label="Assigned"
                  value={`${resolutionDebug.assignedSlug} (${resolutionDebug.assignedDistanceKm.toFixed(2)}km)${resolutionDebug.withinRadius ? '' : ' — fallback'}`}
                />
                {resolutionDebug.candidates?.map((c) => (
                  <Row
                    key={c.slug}
                    label={c.displayName}
                    value={c.distanceKm === Infinity ? 'no location' : `${c.distanceKm.toFixed(2)} km`}
                    warn={!c.withinRadius}
                  />
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>Switch branch</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#FF6B35" style={{ marginTop: 8 }} />
            ) : (
              branches.map((b) => (
                <TouchableOpacity
                  key={b.slug}
                  style={styles.branchButton}
                  onPress={() => previewBranch(b)}
                  disabled={switchingSlug === b.slug}
                >
                  <Text style={styles.branchButtonText}>
                    {b.displayName} ({b.slug})
                  </Text>
                  {switchingSlug === b.slug && <ActivityIndicator size="small" color="#fff" />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, warn && styles.warnText]}>{label}</Text>
      <Text style={[styles.rowValue, warn && styles.warnText]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, zIndex: 9999, elevation: 9999, alignItems: 'center' },
  tab: {
    backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 6,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
  },
  tabText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  panel: {
    backgroundColor: '#111827', width: '94%', marginTop: 2, borderRadius: 10,
    padding: 12, maxHeight: 460,
  },
  sectionTitle: { color: '#9ca3af', fontSize: 10, fontWeight: '700', marginTop: 10, marginBottom: 4, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { color: '#d1d5db', fontSize: 11, flexShrink: 1, marginRight: 8 },
  rowValue: { color: '#fff', fontSize: 11, flexShrink: 1, textAlign: 'right' },
  warnText: { color: '#f87171' },
  branchButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6,
  },
  branchButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});