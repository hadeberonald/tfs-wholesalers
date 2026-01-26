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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  image?: string;
  price: number;
  category: string;
  description?: string;
}

export default function BarcodeLinkingScreen() {
  const { token } = useAuthStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery))
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/products?all=true`);
      setProducts(response.data.products);
      setFilteredProducts(response.data.products);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleScanPress = (product: Product) => {
    setSelectedProduct(product);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    if (!selectedProduct) return;

    try {
      // Check if barcode already exists on another product
      const existingResponse = await axios.get(
        `${API_URL}/api/products?barcode=${scannedBarcode}`
      );

      if (existingResponse.data.product && 
          existingResponse.data.product._id !== selectedProduct._id) {
        Alert.alert(
          'Barcode Already Used',
          `This barcode is already linked to: ${existingResponse.data.product.name}`
        );
        setSelectedProduct(null);
        return;
      }

      // Update product with barcode
      await axios.put(
        `${API_URL}/api/products/${selectedProduct._id}`,
        { barcode: scannedBarcode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setProducts(prev =>
        prev.map(p =>
          p._id === selectedProduct._id
            ? { ...p, barcode: scannedBarcode }
            : p
        )
      );

      Alert.alert(
        'Success',
        `Barcode ${scannedBarcode} linked to ${selectedProduct.name}`
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to link barcode'
      );
    } finally {
      setSelectedProduct(null);
    }
  };

  const handleManualEntry = (product: Product) => {
    Alert.prompt(
      'Enter Barcode',
      `Enter barcode for ${product.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (barcode) => {
            if (!barcode || !barcode.trim()) return;
            
            try {
              // Check if barcode already exists
              const existingResponse = await axios.get(
                `${API_URL}/api/products?barcode=${barcode.trim()}`
              );

              if (existingResponse.data.product && 
                  existingResponse.data.product._id !== product._id) {
                Alert.alert(
                  'Barcode Already Used',
                  `This barcode is already linked to: ${existingResponse.data.product.name}`
                );
                return;
              }

              await axios.put(
                `${API_URL}/api/products/${product._id}`,
                { barcode: barcode.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              setProducts(prev =>
                prev.map(p =>
                  p._id === product._id
                    ? { ...p, barcode: barcode.trim() }
                    : p
                )
              );

              Alert.alert('Success', 'Barcode linked successfully');
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to link barcode'
              );
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveBarcode = (product: Product) => {
    Alert.alert(
      'Remove Barcode',
      `Remove barcode from ${product.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/api/products/${product._id}`,
                { barcode: null },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              setProducts(prev =>
                prev.map(p =>
                  p._id === product._id
                    ? { ...p, barcode: undefined }
                    : p
                )
              );

              Alert.alert('Success', 'Barcode removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove barcode');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Product }) => {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.itemImage} />
          )}
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemSKU}>SKU: {item.sku}</Text>
            <Text style={styles.itemPrice}>R{item.price.toFixed(2)}</Text>
          </View>
        </View>

        {item.barcode ? (
          <View style={styles.barcodeSection}>
            <View style={styles.barcodeInfo}>
              <Ionicons name="barcode" size={24} color="#4CAF50" />
              <View style={styles.barcodeText}>
                <Text style={styles.barcodeLabel}>Linked Barcode:</Text>
                <Text style={styles.barcodeValue}>{item.barcode}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveBarcode(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => handleScanPress(item)}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => handleManualEntry(item)}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.manualButtonText}>Manual</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const linkedCount = products.filter(p => p.barcode).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Link Product Barcodes</Text>
        <Text style={styles.headerSubtitle}>
          {linkedCount} of {products.length} products have barcodes
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(linkedCount / products.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, SKU, or barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
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
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
          setSelectedProduct(null);
        }}
        onScan={handleBarcodeScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemSKU: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  barcodeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f8f4',
    padding: 12,
    borderRadius: 8,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  barcodeText: {
    flex: 1,
  },
  barcodeLabel: {
    fontSize: 12,
    color: '#666',
  },
  barcodeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  removeButton: {
    backgroundColor: '#f44336',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  manualButton: {
    flexDirection: 'row',
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  manualButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});