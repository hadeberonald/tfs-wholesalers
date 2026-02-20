// src/screens/PackagingScreen.tsx
// Every item is shown grouped (regular / special / combo / bonus) with
// full special info so the packer can verify what goes in each box.
// Items are selectable per-package. Status advances to 'collecting' on completion.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  Package,
  QrCode,
  CheckCircle,
  Gift,
  Tag,
  Layers,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import { useOrdersStore } from '../stores/ordersStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  variantName?: string;
  specialType?: string;
  specialConditions?: any;
  specialDescription?: string;
  isBonusItem?: boolean;
  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  autoAdded?: boolean;
  isComboItem?: boolean;
  comboName?: string;
  comboItems?: Array<{ productId: string; productName: string; quantity: number }>;
}

// ─── Item type helpers (same logic as PickingScreen) ─────────────────────────
type GroupKey = 'regular' | 'special' | 'combo' | 'bonus';

interface ItemGroup {
  key: GroupKey;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon: React.FC<any>;
  items: OrderItem[];
}

function classifyItems(items: OrderItem[]): ItemGroup[] {
  const regular: OrderItem[] = [];
  const special: OrderItem[] = [];
  const combo:   OrderItem[] = [];
  const bonus:   OrderItem[] = [];

  for (const item of items) {
    if (item.isComboItem) combo.push(item);
    else if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) bonus.push(item);
    else if (item.specialType) special.push(item);
    else regular.push(item);
  }

  const groups: ItemGroup[] = [];
  if (regular.length) groups.push({ key: 'regular', title: 'Regular Items', color: '#1a1a1a', bgColor: '#f9fafb', borderColor: '#e5e7eb', Icon: ShoppingBag, items: regular });
  if (special.length) groups.push({ key: 'special', title: 'Promo / Special Items', color: '#b45309', bgColor: '#fffbeb', borderColor: '#fde68a', Icon: Tag, items: special });
  if (combo.length)   groups.push({ key: 'combo',   title: 'Combo Deal Items',     color: '#6d28d9', bgColor: '#f5f3ff', borderColor: '#c4b5fd', Icon: Layers, items: combo });
  if (bonus.length)   groups.push({ key: 'bonus',   title: '🎁 Free / Bonus Items', color: '#065f46', bgColor: '#ecfdf5', borderColor: '#6ee7b7', Icon: Gift, items: bonus });
  return groups;
}

function getSpecialLabel(item: OrderItem): string | null {
  if (item.isComboItem && item.comboName) return `📦 Part of "${item.comboName}"`;
  if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) return '🎁 Free bonus — must be included';
  if (!item.specialType) return null;
  switch (item.specialType) {
    case 'percentage_off': return `${item.specialConditions?.discountPercentage}% OFF`;
    case 'amount_off':     return `R${item.specialConditions?.discountAmount} OFF`;
    case 'fixed_price':    return `Special price: R${item.specialConditions?.newPrice}`;
    case 'multibuy':       return `${item.specialConditions?.requiredQuantity} for R${item.specialConditions?.specialPrice}`;
    case 'buy_x_get_y': {
      const d = item.specialConditions?.getDiscount || 100;
      return d === 100
        ? `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} FREE`
        : `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} at ${d}% off`;
    }
    default: return item.specialDescription || 'Special offer';
  }
}

// ─── Collapsible item group for the "Select items for this package" UI ────────
function ItemGroupSelector({
  group,
  selectedIds,
  onToggle,
}: {
  group: ItemGroup;
  selectedIds: Set<string>;
  onToggle: (productId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const selectedInGroup = group.items.filter(i => selectedIds.has(i.productId)).length;

  return (
    <View style={[igs.wrapper, { borderColor: group.borderColor }]}>
      <TouchableOpacity
        style={[igs.header, { backgroundColor: group.bgColor }]}
        onPress={() => setOpen(o => !o)}
      >
        <group.Icon size={16} color={group.color} />
        <Text style={[igs.title, { color: group.color }]}>{group.title}</Text>
        <Text style={[igs.count, { color: group.color }]}>
          {selectedInGroup}/{group.items.length}
        </Text>
        {open ? <ChevronUp size={16} color={group.color} /> : <ChevronDown size={16} color={group.color} />}
      </TouchableOpacity>

      {open && group.items.map((item, idx) => {
        const isSelected = selectedIds.has(item.productId);
        const label = getSpecialLabel(item);
        const isFree = item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded;

        return (
          <TouchableOpacity
            key={`${item.productId}-${idx}`}
            style={[igs.itemRow, isSelected && igs.itemRowSelected, { borderColor: isSelected ? '#10b981' : group.borderColor }]}
            onPress={() => onToggle(item.productId)}
          >
            <View style={{ flex: 1 }}>
              <View style={igs.nameRow}>
                <Text style={igs.itemName}>
                  {item.name}
                  {item.variantName ? <Text style={igs.variant}> — {item.variantName}</Text> : null}
                </Text>
                {isFree && (
                  <View style={igs.freePill}>
                    <Text style={igs.freePillText}>FREE</Text>
                  </View>
                )}
              </View>
              <Text style={igs.itemSku}>SKU: {item.sku}  |  Qty: {item.quantity}</Text>
              {label && <Text style={[igs.specialLabel, { color: group.color }]}>{label}</Text>}
              {item.isComboItem && item.comboItems?.length ? (
                <View style={igs.comboList}>
                  {item.comboItems.map((ci, i) => (
                    <Text key={i} style={igs.comboListItem}>• {ci.quantity}× {ci.productName}</Text>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={[igs.checkbox, isSelected && igs.checkboxSelected]}>
              {isSelected && <CheckCircle size={22} color="#10b981" />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PackagingScreen({ navigation: navProp }: any) {
  const navigation = navProp as any;
  const route = useRoute();
  const params = route.params as { orderId?: string; orderNumber?: string } | undefined;
  const orderId = params?.orderId;

  const { completeOrder } = useOrdersStore();

  const [order, setOrder] = useState<any>(null);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning]         = useState(false);
  const [totalPackages, setTotalPackages] = useState('1');
  const [packages, setPackages]         = useState<any[]>([]);
  const [currentPackageItems, setCurrentPackageItems] = useState<Set<string>>(new Set());

  // ── Fetch order ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) { setLoading(false); return; }
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await axios.get(`${API_URL}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fetched = res.data.order;

        if (fetched.status !== 'packaging') {
          await axios.patch(
            `${API_URL}/api/orders/${orderId}`,
            { status: 'packaging', packagingStartedAt: new Date().toISOString() },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetched.status = 'packaging';
        }

        setOrder(fetched);
        setGroups(classifyItems(fetched.items));
      } catch (err: any) {
        console.error('PackagingScreen fetch error:', err.response?.data || err.message);
        Alert.alert('Error', 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  // ── Select all items by default for first package ──────────────────────────
  useEffect(() => {
    if (order && packages.length === 0) {
      const allIds = new Set<string>(order.items.map((i: OrderItem) => i.productId));
      setCurrentPackageItems(allIds);
    }
  }, [order]);

  // ── QR scan ─────────────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning) return;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageNum  = packages.length + 1;
    const total       = parseInt(totalPackages, 10);

    const newPackage = {
      qrCode:        data,
      packageNumber: packageNum,
      totalPackages: total,
      items:         Array.from(currentPackageItems),
    };

    const updatedPackages = [...(order.packages || []), newPackage];

    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { packages: updatedPackages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOrder((prev: any) => ({ ...prev, packages: updatedPackages }));
      setPackages(prev => [...prev, newPackage]);
      setCurrentPackageItems(new Set());

      Alert.alert('✓ Package Created', `Package ${packageNum} of ${total} sealed.`);

      if (packageNum === total) {
        handleCompleteOrder(updatedPackages);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to create package';
      Alert.alert('Error', msg);
    }
  };

  // ── Complete packaging ───────────────────────────────────────────────────────
  const handleCompleteOrder = async (finalPackages?: any[]) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'collecting', packagingCompletedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await completeOrder(orderId!);
      Alert.alert('Order Packaged! 📦', 'Ready for driver collection.', [
        { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Orders' }) },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to complete packaging');
    }
  };

  const toggleItemForPackage = (productId: string) => {
    setCurrentPackageItems(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  const selectAllItems = () => {
    if (!order) return;
    setCurrentPackageItems(new Set(order.items.map((i: OrderItem) => i.productId)));
  };

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order…</Text>
      </View>
    );
  }

  if (!orderId || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{!orderId ? 'No order ID provided' : 'Order not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allPackagesCreated = packages.length === parseInt(totalPackages, 10);
  const selectedCount      = currentPackageItems.size;
  const totalItems         = order.items.length;
  const bonusCount  = order.items.filter((i: OrderItem) => i.isBonusItem || i.isFreeItem || i.isMultibuyBonus || i.autoAdded).length;
  const comboCount  = order.items.filter((i: OrderItem) => i.isComboItem).length;
  const specialCount= order.items.filter((i: OrderItem) => i.specialType && !i.isComboItem && !i.isBonusItem).length;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      <StatusStepper currentStatus={order.status} />

      {/* Order composition summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Composition</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <ShoppingBag size={14} color="#374151" />
            <Text style={styles.summaryChipText}>{totalItems - bonusCount - comboCount - specialCount} Regular</Text>
          </View>
          {specialCount > 0 && (
            <View style={[styles.summaryChip, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Tag size={14} color="#b45309" />
              <Text style={[styles.summaryChipText, { color: '#b45309' }]}>{specialCount} Promo</Text>
            </View>
          )}
          {comboCount > 0 && (
            <View style={[styles.summaryChip, { backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' }]}>
              <Layers size={14} color="#6d28d9" />
              <Text style={[styles.summaryChipText, { color: '#6d28d9' }]}>{comboCount} Combo</Text>
            </View>
          )}
          {bonusCount > 0 && (
            <View style={[styles.summaryChip, { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }]}>
              <Gift size={14} color="#065f46" />
              <Text style={[styles.summaryChipText, { color: '#065f46' }]}>{bonusCount} Free</Text>
            </View>
          )}
        </View>
        {bonusCount > 0 && (
          <View style={styles.warningRow}>
            <Text style={styles.warningText}>
              ⚠️ {bonusCount} free/bonus item{bonusCount > 1 ? 's' : ''} MUST be included in a package
            </Text>
          </View>
        )}
      </View>

      {/* Package count input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Total Packages</Text>
        <TextInput
          style={styles.input}
          value={totalPackages}
          onChangeText={setTotalPackages}
          keyboardType="number-pad"
          editable={packages.length === 0}
          placeholder="How many boxes/bags?"
        />
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(packages.length / parseInt(totalPackages, 10)) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {packages.length} / {totalPackages} packages sealed
        </Text>
      </View>

      {/* Current package builder */}
      {!allPackagesCreated && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              Package {packages.length + 1} of {totalPackages} — Select Items
            </Text>
            <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllItems}>
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHint}>
            {selectedCount} of {totalItems} items selected for this package
          </Text>

          {/* Grouped item checkboxes */}
          {groups.map(grp => (
            <ItemGroupSelector
              key={grp.key}
              group={grp}
              selectedIds={currentPackageItems}
              onToggle={toggleItemForPackage}
            />
          ))}

          {/* QR Scanner */}
          {scanning ? (
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleQRScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>Scan the package QR label</Text>
                <TouchableOpacity style={styles.cancelScanButton} onPress={() => setScanning(false)}>
                  <Text style={styles.cancelScanText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.scanButton, selectedCount === 0 && styles.scanButtonDisabled]}
              onPress={() => {
                if (!permission?.granted) requestPermission();
                else setScanning(true);
              }}
              disabled={selectedCount === 0}
            >
              <QrCode size={22} color="#fff" />
              <Text style={styles.scanButtonText}>
                Scan QR Label — Package {packages.length + 1}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Created packages list */}
      {packages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sealed Packages</Text>
          {packages.map((pkg, i) => (
            <View key={i} style={styles.packageCard}>
              <View style={styles.packageHeader}>
                <Package size={22} color="#10b981" />
                <Text style={styles.packageTitle}>
                  Package {pkg.packageNumber} of {pkg.totalPackages}
                </Text>
                <CheckCircle size={22} color="#10b981" />
              </View>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
              <Text style={styles.packageItems}>{pkg.items.length} product types inside</Text>
            </View>
          ))}
        </View>
      )}

      {/* Complete button */}
      {allPackagesCreated && (
        <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteOrder()}>
          <CheckCircle size={24} color="#fff" />
          <Text style={styles.completeButtonText}>Complete Packaging</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginBottom: 8 },

  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: { marginTop: 12 },
  backButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  orderNumber: { fontSize: 16, color: '#666' },

  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryChipText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  warningRow: {
    marginTop: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
  },
  warningText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  section: { backgroundColor: '#fff', padding: 16, marginTop: 12, marginHorizontal: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  sectionHint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  selectAllText: { fontSize: 12, color: '#FF6B35', fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },

  progressSection: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  progressBar: { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#10b981' },
  progressText: { fontSize: 14, color: '#666', textAlign: 'center' },

  scannerContainer: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: { width: 200, height: 200, borderWidth: 3, borderColor: '#FF6B35', borderRadius: 12 },
  scannerText: { marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelScanButton: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  scanButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  scanButtonDisabled: { opacity: 0.4 },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  packageCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  packageTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
  packageQR: { fontSize: 13, color: '#666', marginBottom: 2 },
  packageItems: { fontSize: 13, fontWeight: '600', color: '#374151' },

  completeButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

// ─── Item group selector styles ───────────────────────────────────────────────
const igs = StyleSheet.create({
  wrapper: { borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  title: { flex: 1, fontSize: 13, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemRowSelected: { backgroundColor: '#f0fdf4' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  variant: { fontWeight: '400', color: '#6b7280' },
  itemSku: { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  specialLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  freePill: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  freePillText: { fontSize: 10, fontWeight: '800', color: '#065f46' },
  comboList: { marginTop: 4 },
  comboListItem: { fontSize: 11, color: '#6d28d9', marginBottom: 1 },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxSelected: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
});