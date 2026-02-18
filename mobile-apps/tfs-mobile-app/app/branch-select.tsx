import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: string;
  settings?: {
    storeLocation: {
      address: string;
    };
    contactPhone: string;
  };
}

export default function BranchSelect() {
  const router = useRouter();
  const setBranch = useStore((state) => state.setBranch);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[BRANCH SELECT] Fetching from:', api.defaults.baseURL);
      const response = await api.get('/api/mobile/branches');
      console.log('[BRANCH SELECT] Got response:', response.data);
      
      if (response.data.success && response.data.branches) {
        console.log('[BRANCH SELECT] Setting', response.data.branches.length, 'branches');
        setBranches(response.data.branches);
      } else {
        setError('No branches available');
      }
    } catch (error: any) {
      console.error('[BRANCH SELECT] Error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBranch = async (branch: Branch) => {
    try {
      console.log('[BRANCH SELECT] Selecting branch:', branch.name);
      await setBranch(branch);
      console.log('[BRANCH SELECT] Navigating to tabs');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[BRANCH SELECT] Select error:', error);
      setError('Failed to select branch');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading branches...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchBranches}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (branches.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="business-outline" size={60} color="#9ca3af" />
        <Text style={styles.emptyText}>No branches available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchBranches}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        
        <Text style={styles.title}>Welcome to TFS Wholesalers</Text>
        <Text style={styles.subtitle}>Select your nearest branch to continue</Text>
      </View>

      <View style={styles.branchList}>
        {branches.map((branch) => (
          <TouchableOpacity
            key={branch._id}
            style={styles.branchCard}
            onPress={() => handleSelectBranch(branch)}
            activeOpacity={0.7}
          >
            <View style={styles.branchIconContainer}>
              <Ionicons name="business" size={28} color="#FF6B35" />
            </View>
            <View style={styles.branchInfo}>
              <Text style={styles.branchName}>{branch.displayName || branch.name}</Text>
              {branch.settings?.storeLocation?.address && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color="#6b7280" />
                  <Text style={styles.branchAddress} numberOfLines={2}>
                    {branch.settings.storeLocation.address}
                  </Text>
                </View>
              )}
              {branch.settings?.contactPhone && (
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={14} color="#FF6B35" />
                  <Text style={styles.branchPhone}>{branch.settings.contactPhone}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FF6B35" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  branchList: {
    gap: 16,
  },
  branchCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  branchIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fef3e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  branchAddress: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  branchPhone: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
});