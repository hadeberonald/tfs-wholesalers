import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
  TouchableOpacity, Image, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Download } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

interface Catalogue {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  expiryDate: string;
}

export default function CataloguesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const branch = useStore((state) => state.branch);

  const [catalogues, setCatalogues]       = useState<Catalogue[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchCatalogues = useCallback(async () => {
    if (!branch?._id) { setLoading(false); return; }
    try {
      const res = await api.get('/api/catalogues', { params: { branchId: branch._id } });
      setCatalogues(res.data.catalogues || []);
    } catch (error) {
      console.error('[CATALOGUES] Failed to fetch:', error);
      Alert.alert('Error', 'Could not load catalogues. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch?._id]);

  useEffect(() => { fetchCatalogues(); }, [fetchCatalogues]);

  const onRefresh = () => { setRefreshing(true); fetchCatalogues(); };

  const handleDownload = async (catalogue: Catalogue) => {
    try {
      setDownloadingId(catalogue._id);
      const ext = catalogue.fileType === 'pdf' ? 'pdf' : 'png';
      const filename = `${catalogue.title.replace(/[^a-z0-9]+/gi, '-')}.${ext}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const { uri } = await FileSystem.downloadAsync(catalogue.fileUrl, fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Downloaded', `Saved to ${uri}`);
      }
    } catch (error) {
      console.error('[CATALOGUES] Download failed:', error);
      Alert.alert('Error', 'Could not download this catalogue.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.push('/(tabs)'))} style={styles.backBtn}>
          <ArrowLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catalogues</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : catalogues.length === 0 ? (
        <View style={styles.centered}>
          <FileText color="#d1d5db" size={48} />
          <Text style={styles.emptyTitle}>No catalogues found</Text>
          <Text style={styles.emptySubtitle}>Check back soon for new catalogues</Text>
        </View>
      ) : (
        <FlatList
          data={catalogues}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.thumb}>
                {item.fileType === 'image' ? (
                  <Image source={{ uri: item.fileUrl }} style={styles.thumbImage} resizeMode="cover" />
                ) : (
                  <FileText color="#9ca3af" size={32} />
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
                ) : null}
                <Text style={styles.cardExpiry}>
                  Valid until {new Date(item.expiryDate).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => handleDownload(item)}
                disabled={downloadingId === item._id}
              >
                {downloadingId === item._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Download color="#fff" size={18} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 12, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumb: {
    width: 56, height: 56, borderRadius: 10, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  cardDescription: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardExpiry: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  downloadBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B35',
    alignItems: 'center', justifyContent: 'center',
  },
});