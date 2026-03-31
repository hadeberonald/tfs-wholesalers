// src/screens/BarcodeLinkingScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  image?: string;
  images?: string[];
  price: number;
  category: string;
  description?: string;
  stockLevel?: number;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  variants?: Array<{
    _id: string;
    name: string;
    sku: string;
    barcode?: string;
    stockLevel?: number;
  }>;
}

export default function BarcodeLinkingScreen() {
  const { token } = useAuthStore();

  const [products, setProducts]               = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [scannerVisible, setScannerVisible]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]         = useState('');

  // FIXED: correctly parse both response shapes, and send auth header
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/products?all=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // API returns { products: [] } — was accidentally reading .product (singular)
      const list: Product[] =
        response.data.products ||
        response.data.product ||
        response.data ||
        [];
      setProducts(list);
      setFilteredProducts(list);
    } catch (error: any) {
      console.error('fetchProducts error:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to fetch products. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [token]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(searchQuery)) ||
          p.variants?.some(v => v.sku.toLowerCase().includes(q) || (v.barcode && v.barcode.includes(searchQuery)))
        )
      );
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const handleScanPress = (product: Product, variantId?: string) => {
    setSelectedProduct(product);
    setSelectedVariantId(variantId || null);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    if (!selectedProduct) return;

    try {
      const existingRes = await axios.get(
        `${API_URL}/api/products?barcode=${scannedBarcode}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (existingRes.data.product && existingRes.data.product._id !== selectedProduct._id) {
        Alert.alert('Barcode Already Used', `This barcode is already linked to: ${existingRes.data.product.name}`);
        setSelectedProduct(null);
        setSelectedVariantId(null);
        return;
      }

      await linkBarcode(selectedProduct, selectedVariantId, scannedBarcode);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to link barcode');
    } finally {
      setSelectedProduct(null);
      setSelectedVariantId(null);
    }
  };

  const linkBarcode = async (product: Product, variantId: string | null, barcode: string) => {
    const body = variantId ? { variantId, barcode } : { barcode };

    await axios.put(
      `${API_URL}/api/products/${product._id}`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setProducts(prev =>
      prev.map(p => {
        if (p._id !== product._id) return p;
        if (variantId && p.variants) {
          return {
            ...p,
            variants: p.variants.map(v => v._id === variantId ? { ...v, barcode } : v),
          };
        }
        return { ...p, barcode };
      })
    );

    const label = variantId
      ? `${product.name} - ${product.variants?.find(v => v._id === variantId)?.name}`
      : product.name;

    Alert.alert('✓ Linked', `Barcode ${barcode} linked to ${label}`);
  };

  const handleManualEntry = (product: Product, variantId?: string) => {
    Alert.prompt(
      'Enter Barcode',
      `Enter barcode for ${product.name}${variantId ? ` - ${product.variants?.find(v => v._id === variantId)?.name}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (barcode) => {
            if (!barcode?.trim()) return;
            try {
              const existingRes = await axios.get(
                `${API_URL}/api/products?barcode=${barcode.trim()}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
              );
              if (existingRes.data.product && existingRes.data.product._id !== product._id) {
                Alert.alert('Barcode Already Used', `Already linked to: ${existingRes.data.product.name}`);
                return;
              }
              await linkBarcode(product, variantId || null, barcode.trim());
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to link barcode');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveBarcode = (product: Product, variantId?: string) => {
    const label = variantId
      ? `${product.name} - ${product.variants?.find(v => v._id === variantId)?.name}`
      : product.name;

    Alert.alert('Remove Barcode', `Remove barcode from ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const body = variantId ? { variantId, barcode: null } : { barcode: null };
            await axios.put(`${API_URL}/api/products/${product._id}`, body, { headers: { Authorization: `Bearer ${token}` } });
            setProducts(prev =>
              prev.map(p => {
                if (p._id !== product._id) return p;
                if (variantId && p.variants) {
                  return { ...p, variants: p.variants.map(v => v._id === variantId ? { ...v, barcode: undefined } : v) };
                }
                return { ...p, barcode: undefined };
              })
            );
            Alert.alert('✓ Removed', 'Barcode unlinked');
          } catch {
            Alert.alert('Error', 'Failed to remove barcode');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Product }) => {
    const image = item.image || item.images?.[0];
    const isLowStock = item.stockLevel !== undefined && item.lowStockThreshold !== undefined && item.stockLevel <= item.lowStockThreshold;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          {image
            ? <Image source={{ uri: image }} style={styles.itemImage} />
            : <View style={[styles.itemImage, styles.itemImageFallback]}><Ionicons name="cube-outline" size={28} color="#ccc" /></View>
          }
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemSKU}>SKU: {item.sku}</Text>
            <Text style={styles.itemPrice}>R{item.price?.toFixed(2)}</Text>
            {isLowStock && (
              <View style={styles.lowStockBadge}>
                <Ionicons name="warning-outline" size={12} color="#f59e0b" />
                <Text style={styles.lowStockText}>Low stock - {item.stockLevel} left</Text>
              </View>
            )}
          </View>
        </View>

        {!item.hasVariants && (
          item.barcode ? (
            <View style={styles.barcodeSection}>
              <View style={styles.barcodeInfo}>
                <Ionicons name="barcode" size={24} color="#4CAF50" />
                <View style={styles.barcodeText}>
                  <Text style={styles.barcodeLabel}>Linked Barcode:</Text>
                  <Text style={styles.barcodeValue}>{item.barcode}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBarcode(item)}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.scanButton} onPress={() => handleScanPress(item)}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Scan Barcode</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualButton} onPress={() => handleManualEntry(item)}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.manualButtonText}>Manual</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {item.hasVariants && item.variants && item.variants.map(variant => (
          <View key={variant._id} style={styles.variantRow}>
            <View style={styles.variantHeader}>
              <Text style={styles.variantName}>{variant.name}</Text>
              <Text style={styles.variantSku}>SKU: {variant.sku}</Text>
            </View>
            {variant.barcode ? (
              <View style={styles.barcodeSection}>
                <View style={styles.barcodeInfo}>
                  <Ionicons name="barcode" size={20} color="#4CAF50" />
                  <View style={styles.barcodeText}>
                    <Text style={styles.barcodeLabel}>Barcode:</Text>
                    <Text style={styles.barcodeValue}>{variant.barcode}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBarcode(item, variant._id)}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.scanButton} onPress={() => handleScanPress(item, variant._id)}>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.scanButtonText}>Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.manualButton} onPress={() => handleManualEntry(item, variant._id)}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.manualButtonText}>Manual</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const totalProducts = products.length;
  const linkedCount   = products.filter(p => {
    if (p.hasVariants && p.variants) return p.variants.every(v => !!v.barcode);
    return !!p.barcode;
  }).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Link Product Barcodes</Text>
        <Text style={styles.headerSubtitle}>{linkedCount} of {totalProducts} products fully linked</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: totalProducts > 0 ? `${(linkedCount / totalProducts) * 100}%` : '0%' }]} />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, SKU, or barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No products match your search' : 'No products found'}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchProducts}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => { setScannerVisible(false); setSelectedProduct(null); setSelectedVariantId(null); }}
        onScan={handleBarcodeScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle:    { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 15, color: '#666', marginTop: 4 },
  progressBar: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 16 },
  list: { padding: 16, paddingTop: 0 },
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  itemImage: { width: 70, height: 70, borderRadius: 8, marginRight: 12 },
  itemImageFallback: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  itemDetails: { flex: 1, justifyContent: 'center' },
  itemName:  { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  itemSKU:   { fontSize: 14, color: '#666', marginBottom: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
  lowStockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  lowStockText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
  variantRow: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 },
  variantHeader: { marginBottom: 6 },
  variantName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  variantSku: { fontSize: 12, color: '#9ca3af' },
  barcodeSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f8f4', padding: 12, borderRadius: 8 },
  barcodeInfo:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  barcodeText:  { flex: 1 },
  barcodeLabel: { fontSize: 12, color: '#666' },
  barcodeValue: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', fontFamily: 'monospace' },
  removeButton: { backgroundColor: '#f44336', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  scanButton:   { flex: 1, flexDirection: 'row', backgroundColor: '#FF6B35', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  manualButton: { flexDirection: 'row', backgroundColor: '#666', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  manualButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: '#999' },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#FF6B35' },
  retryText: { color: '#FF6B35', fontWeight: '600' },
});