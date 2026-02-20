// src/screens/BranchSelectScreen.tsx
// Shown after login if no branch is selected yet.
// Also accessible from the header "Change Branch" button.
//
// Fetches all active branches from the API, lets the picker tap one,
// persists it via authStore.setActiveBranch(), then explicitly resets
// the navigation stack to Main so the app never relies on a re-render
// swap to navigate.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { MapPin, Building2, ChevronRight, RefreshCw, LogOut } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuthStore, Branch } from '../stores/authStore';

const API_URL = 'https://tfs-wholesalers.onrender.com';

export default function BranchSelectScreen() {
  const navigation = useNavigation<any>();
  const { token, user, activeBranch, setActiveBranch, logout } = useAuthStore();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null); // branch id being selected

  const fetchBranches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Support both { branches: [] } and { data: [] } shapes
      const list: Branch[] =
        response.data.branches ||
        response.data.data ||
        response.data ||
        [];

      // Only show active branches
      setBranches(list.filter((b) => b.isActive !== false));
    } catch (error: any) {
      console.error('Failed to fetch branches:', error.response?.data || error.message);
      if (!silent) {
        Alert.alert('Error', 'Could not load branches. Please check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleSelectBranch = async (branch: Branch) => {
    setSelecting(branch._id || branch.id || '');
    try {
      await setActiveBranch(branch);
      // Explicitly reset the stack to Main — don't rely on re-render alone.
      // This works whether we're coming from the initial gate or the modal.
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to select branch. Please try again.');
    } finally {
      setSelecting(null);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const renderBranch = ({ item }: { item: Branch }) => {
    const branchId = item._id || item.id || '';
    const isCurrentBranch = activeBranch?._id === branchId || activeBranch?.id === branchId;
    const isSelecting = selecting === branchId;

    return (
      <TouchableOpacity
        style={[
          styles.branchCard,
          isCurrentBranch && styles.branchCardActive,
        ]}
        onPress={() => handleSelectBranch(item)}
        disabled={!!selecting}
        activeOpacity={0.7}
      >
        <View style={[styles.branchIconWrap, isCurrentBranch && styles.branchIconWrapActive]}>
          <Building2
            size={24}
            color={isCurrentBranch ? '#fff' : '#FF6B35'}
          />
        </View>

        <View style={styles.branchInfo}>
          <Text style={[styles.branchName, isCurrentBranch && styles.branchNameActive]}>
            {item.name}
          </Text>
          {(item.city || item.address) && (
            <View style={styles.branchAddressRow}>
              <MapPin size={13} color={isCurrentBranch ? 'rgba(255,255,255,0.7)' : '#9ca3af'} />
              <Text style={[styles.branchAddress, isCurrentBranch && styles.branchAddressActive]}>
                {[item.address, item.city, item.province].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          {item.phone && (
            <Text style={[styles.branchPhone, isCurrentBranch && { color: 'rgba(255,255,255,0.7)' }]}>
              {item.phone}
            </Text>
          )}
        </View>

        <View style={styles.branchRight}>
          {isSelecting ? (
            <ActivityIndicator size="small" color={isCurrentBranch ? '#fff' : '#FF6B35'} />
          ) : isCurrentBranch ? (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Active</Text>
            </View>
          ) : (
            <ChevronRight size={20} color="#9ca3af" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Select Branch</Text>
          <Text style={styles.headerSub}>
            {user?.name ? `Welcome, ${user.name}` : 'Choose your branch to continue'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <View style={styles.descRow}>
        <MapPin size={15} color="#FF6B35" />
        <Text style={styles.descText}>
          Orders and deliveries will be filtered to your selected branch.
        </Text>
      </View>

      {/* Branch List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading branches…</Text>
        </View>
      ) : branches.length === 0 ? (
        <View style={styles.centered}>
          <Building2 size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Branches Found</Text>
          <Text style={styles.emptyText}>
            No active branches are available. Contact your administrator.
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => { setRefreshing(true); fetchBranches(); }}
          >
            <RefreshCw size={18} color="#FF6B35" />
            <Text style={styles.refreshBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={branches}
          renderItem={renderBranch}
          keyExtractor={(item) => item._id || item.id || item.slug}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBranches(true); }}
              tintColor="#FF6B35"
            />
          }
          ListFooterComponent={
            <Text style={styles.footerNote}>
              {branches.length} branch{branches.length !== 1 ? 'es' : ''} available
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#666' },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  descRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff7f3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  descText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },

  list: { padding: 16, paddingBottom: 40 },

  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  branchCardActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  branchIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7f3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
  },
  branchIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)',
  },

  branchInfo: { flex: 1 },
  branchName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  branchNameActive: { color: '#fff' },
  branchAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  branchAddress: { fontSize: 12, color: '#9ca3af', flex: 1 },
  branchAddressActive: { color: 'rgba(255,255,255,0.8)' },
  branchPhone: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  branchRight: { width: 40, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  activePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  refreshBtnText: { color: '#FF6B35', fontSize: 15, fontWeight: '600' },

  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 16,
  },
});