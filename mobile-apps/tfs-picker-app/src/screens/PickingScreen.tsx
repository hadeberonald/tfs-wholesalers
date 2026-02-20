// src/screens/PickingScreen.tsx
// Every single item — regular, bonus, free, combo, multibuy — must be
// individually scanned or manually confirmed before the order can proceed.
// Items are grouped by type so pickers can't accidentally skip bundled items.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Gift,
  Tag,
  Package as PackageIcon,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Star,
  Percent,
} from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  barcode?: string;
  image?: string;
  variantName?: string;

  // Special fields
  appliedSpecialId?: string;
  specialType?: string;
  specialConditions?: any;
  specialDescription?: string;
  specialDiscount?: number;
  originalPrice?: number;

  // Bonus / free item flags
  isBonusItem?: boolean;
  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  autoAdded?: boolean;
  linkedToItemId?: string;

  // Combo fields
  isComboItem?: boolean;
  comboId?: string;
  comboName?: string;
  comboItems?: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  status: string;
  total: number;
  subtotal?: number;
  totalSavings?: number;
  customerInfo?: { name: string; phone?: string };
  shippingAddress?: any;
}

// ─── Item group definitions ───────────────────────────────────────────────────
type GroupKey = 'regular' | 'special' | 'combo' | 'bonus';

interface ItemGroup {
  key: GroupKey;
  title: string;
  subtitle: string;
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
    if (item.isComboItem) {
      combo.push(item);
    } else if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) {
      bonus.push(item);
    } else if (item.specialType || item.appliedSpecialId) {
      special.push(item);
    } else {
      regular.push(item);
    }
  }

  const groups: ItemGroup[] = [];

  if (regular.length > 0) groups.push({
    key: 'regular',
    title: 'Regular Items',
    subtitle: `${regular.length} item${regular.length !== 1 ? 's' : ''} — scan each one`,
    color: '#1a1a1a',
    bgColor: '#f9fafb',
    borderColor: '#e5e7eb',
    Icon: ShoppingBag,
    items: regular,
  });

  if (special.length > 0) groups.push({
    key: 'special',
    title: 'Special / Promo Items',
    subtitle: `${special.length} item${special.length !== 1 ? 's' : ''} — discounted, must all be scanned`,
    color: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    Icon: Tag,
    items: special,
  });

  if (combo.length > 0) groups.push({
    key: 'combo',
    title: 'Combo Deal Items',
    subtitle: `${combo.length} item${combo.length !== 1 ? 's' : ''} — part of a bundle`,
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    Icon: Layers,
    items: combo,
  });

  if (bonus.length > 0) groups.push({
    key: 'bonus',
    title: '🎁 Free / Bonus Items',
    subtitle: `${bonus.length} item${bonus.length !== 1 ? 's' : ''} — MUST be included`,
    color: '#065f46',
    bgColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    Icon: Gift,
    items: bonus,
  });

  return groups;
}

// ─── Unique scan key per item slot ────────────────────────────────────────────
// We use productId + variantId + index so duplicate products each need a scan.
function itemScanKey(item: OrderItem, index: number): string {
  return `${item.productId}__${item.variantName || ''}__${index}`;
}

// ─── Special description helper ──────────────────────────────────────────────
function getSpecialLabel(item: OrderItem): { badge: string; desc: string; color: string; bg: string } | null {
  if (item.isComboItem && item.comboName) {
    return { badge: 'COMBO', desc: `Part of "${item.comboName}"`, color: '#6d28d9', bg: '#ede9fe' };
  }
  if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) {
    return { badge: 'FREE', desc: 'Bonus item — include at no charge', color: '#065f46', bg: '#d1fae5' };
  }
  if (!item.specialType) return null;

  switch (item.specialType) {
    case 'percentage_off': {
      const pct = item.specialConditions?.discountPercentage;
      return { badge: `${pct}% OFF`, desc: `${pct}% discount applied`, color: '#92400e', bg: '#fef3c7' };
    }
    case 'amount_off': {
      const amt = item.specialConditions?.discountAmount;
      return { badge: `R${amt} OFF`, desc: `R${amt} discount applied`, color: '#92400e', bg: '#fef3c7' };
    }
    case 'fixed_price': {
      const price = item.specialConditions?.newPrice;
      return { badge: 'SPECIAL PRICE', desc: `Special price: R${price}`, color: '#92400e', bg: '#fef3c7' };
    }
    case 'multibuy': {
      const qty = item.specialConditions?.requiredQuantity;
      const sp  = item.specialConditions?.specialPrice;
      return { badge: 'MULTIBUY', desc: `${qty} for R${sp}`, color: '#1d4ed8', bg: '#dbeafe' };
    }
    case 'buy_x_get_y': {
      const buyQ = item.specialConditions?.buyQuantity;
      const getQ = item.specialConditions?.getQuantity;
      const disc = item.specialConditions?.getDiscount || 100;
      const descStr = disc === 100
        ? `Buy ${buyQ}, get ${getQ} FREE`
        : `Buy ${buyQ}, get ${getQ} at ${disc}% off`;
      return { badge: 'BUY X GET Y', desc: descStr, color: '#065f46', bg: '#d1fae5' };
    }
    case 'bundle':
      return { badge: 'BUNDLE', desc: item.specialDescription || 'Bundle deal', color: '#6d28d9', bg: '#ede9fe' };
    default:
      return { badge: 'SPECIAL', desc: item.specialDescription || 'Special offer', color: '#92400e', bg: '#fef3c7' };
  }
}

// ─── Single item card ─────────────────────────────────────────────────────────
interface ItemCardProps {
  item: OrderItem;
  scanKey: string;
  isScanned: boolean;
  onScan: (item: OrderItem) => void;
  onManual: (item: OrderItem, scanKey: string) => void;
  groupColor: string;
  groupBg: string;
}

function ItemCard({ item, scanKey, isScanned, onScan, onManual, groupColor, groupBg }: ItemCardProps) {
  const special = getSpecialLabel(item);
  const lineTotal = (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded)
    ? 0
    : item.price * item.quantity;

  return (
    <View style={[
      ic.card,
      { borderColor: isScanned ? '#10b981' : groupColor + '55' },
      isScanned && ic.cardScanned,
    ]}>
      {/* Scanned overlay tick */}
      {isScanned && (
        <View style={ic.scannedBanner}>
          <CheckCircle size={14} color="#fff" />
          <Text style={ic.scannedBannerText}>PICKED</Text>
        </View>
      )}

      <View style={ic.row}>
        {/* Image */}
        {item.image ? (
          <Image source={{ uri: item.image }} style={ic.img} />
        ) : (
          <View style={[ic.img, ic.imgFb, { backgroundColor: groupBg }]}>
            <PackageIcon size={22} color={groupColor} />
          </View>
        )}

        {/* Info */}
        <View style={ic.info}>
          <Text style={ic.name} numberOfLines={2}>
            {item.name}
            {item.variantName ? (
              <Text style={ic.variant}> — {item.variantName}</Text>
            ) : null}
          </Text>
          <Text style={ic.sku}>SKU: {item.sku}</Text>

          {/* Special badge + description */}
          {special && (
            <View style={[ic.badge, { backgroundColor: special.bg }]}>
              <Text style={[ic.badgeText, { color: special.color }]}>{special.badge}</Text>
              <Text style={[ic.badgeDesc, { color: special.color }]}>{special.desc}</Text>
            </View>
          )}

          {/* Combo items breakdown */}
          {item.isComboItem && item.comboItems && item.comboItems.length > 0 && (
            <View style={ic.comboBox}>
              <Text style={ic.comboBoxTitle}>Combo includes:</Text>
              {item.comboItems.map((ci, idx) => (
                <View key={idx} style={ic.comboRow}>
                  <View style={ic.comboQtyDot}>
                    <Text style={ic.comboQtyText}>{ci.quantity}×</Text>
                  </View>
                  <Text style={ic.comboItemName}>{ci.productName}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Price + qty row */}
          <View style={ic.priceRow}>
            <View style={ic.qtyPill}>
              <Text style={ic.qtyText}>×{item.quantity}</Text>
            </View>
            {item.originalPrice && item.originalPrice !== item.price && (
              <Text style={ic.origPrice}>R{(item.originalPrice * item.quantity).toFixed(2)}</Text>
            )}
            <Text style={[ic.price, lineTotal === 0 && ic.priceFree]}>
              {lineTotal === 0 ? 'FREE' : `R${lineTotal.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Barcode indicator */}
        <View style={ic.barcodeCol}>
          {item.barcode ? (
            <View style={ic.barcodeHas}>
              <Ionicons name="barcode" size={16} color="#10b981" />
            </View>
          ) : (
            <View style={ic.barcodeNone}>
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
            </View>
          )}
        </View>
      </View>

      {/* Action buttons */}
      {!isScanned && (
        <View style={ic.actions}>
          {item.barcode ? (
            <TouchableOpacity style={ic.scanBtn} onPress={() => onScan(item)}>
              <Ionicons name="barcode-outline" size={18} color="#fff" />
              <Text style={ic.scanBtnText}>Scan Barcode</Text>
            </TouchableOpacity>
          ) : (
            <View style={ic.noBarcodeWarn}>
              <Ionicons name="warning-outline" size={15} color="#f59e0b" />
              <Text style={ic.noBarcodeText}>No barcode — use manual confirm</Text>
            </View>
          )}
          <TouchableOpacity style={ic.manualBtn} onPress={() => onManual(item, scanKey)}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={ic.manualBtnText}>Manual</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Collapsible group section ────────────────────────────────────────────────
interface GroupSectionProps {
  group: ItemGroup;
  scanKeys: string[];        // one key per item slot
  scannedSet: Set<string>;
  onScan: (item: OrderItem) => void;
  onManual: (item: OrderItem, scanKey: string) => void;
}

function GroupSection({ group, scanKeys, scannedSet, onScan, onManual }: GroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const doneCount = scanKeys.filter(k => scannedSet.has(k)).length;
  const allDone   = doneCount === scanKeys.length;

  return (
    <View style={[gs.wrapper, { borderColor: group.borderColor }]}>
      {/* Group header */}
      <TouchableOpacity
        style={[gs.header, { backgroundColor: group.bgColor }]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <View style={[gs.iconWrap, { backgroundColor: group.color + '20' }]}>
          <group.Icon size={20} color={group.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gs.title, { color: group.color }]}>{group.title}</Text>
          <Text style={gs.subtitle}>{group.subtitle}</Text>
        </View>
        <View style={[gs.progress, allDone && gs.progressDone]}>
          <Text style={[gs.progressText, allDone && gs.progressTextDone]}>
            {doneCount}/{scanKeys.length}
          </Text>
        </View>
        {expanded
          ? <ChevronUp size={18} color={group.color} />
          : <ChevronDown size={18} color={group.color} />
        }
      </TouchableOpacity>

      {/* Items */}
      {expanded && group.items.map((item, idx) => (
        <ItemCard
          key={scanKeys[idx]}
          item={item}
          scanKey={scanKeys[idx]}
          isScanned={scannedSet.has(scanKeys[idx])}
          onScan={onScan}
          onManual={onManual}
          groupColor={group.color}
          groupBg={group.bgColor}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PickingScreen({ route, navigation: navProp }: any) {
  const { orderId } = route.params;
  const { token } = useAuthStore();
  const navigation = navProp as any;

  const [order, setOrder]             = useState<Order | null>(null);
  const [groups, setGroups]           = useState<ItemGroup[]>([]);
  const [allScanKeys, setAllScanKeys] = useState<string[]>([]);
  const [scanned, setScanned]         = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<OrderItem | null>(null);

  // ── Fetch + enrich ──────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let orderData: Order = res.data.order;

      // Enrich items with product data (barcodes, images)
      orderData = {
        ...orderData,
        items: await enrichItems(orderData.items, token),
      };

      setOrder(orderData);

      // Build groups + scan key map
      const g = classifyItems(orderData.items);
      setGroups(g);

      // Flat list of ALL scan keys in group order
      const keys: string[] = [];
      let globalIdx = 0;
      for (const grp of g) {
        for (const item of grp.items) {
          keys.push(itemScanKey(item, globalIdx));
          globalIdx++;
        }
      }
      setAllScanKeys(keys);

      // Auto-advance status to 'picking'
      if (orderData.status === 'pending' || orderData.status === 'confirmed') {
        await axios.patch(
          `${API_URL}/api/orders/${orderId}`,
          { status: 'picking', pickingStartedAt: new Date().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOrder(prev => prev ? { ...prev, status: 'picking' } : prev);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load order');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // ── Barcode scanning ────────────────────────────────────────────────────────
  const openScanner = (item: OrderItem) => {
    if (!item.barcode) {
      Alert.alert('No Barcode', 'This product has no barcode. Use manual confirm.');
      return;
    }
    setCurrentItem(item);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    if (!currentItem) return;

    if (currentItem.barcode === scannedBarcode) {
      // Find the first unscanned slot for this item
      const key = findUnscannedKey(currentItem);
      if (key) markScanned(key);
      Alert.alert('✓ Correct', `${currentItem.name} picked!`);
    } else {
      // Look up what product was actually scanned
      try {
        const res = await axios.get(`${API_URL}/api/products?barcode=${scannedBarcode}`);
        const wrongName = res.data.product?.name || 'unknown product';
        Alert.alert(
          '✗ Wrong Item',
          `You scanned: ${wrongName}\n\nExpected: ${currentItem.name}`,
          [{ text: 'OK' }]
        );
      } catch {
        Alert.alert('✗ Wrong Barcode', `Expected barcode for: ${currentItem.name}`);
      }
    }
    setCurrentItem(null);
  };

  const handleManual = (item: OrderItem, scanKey: string) => {
    const special = getSpecialLabel(item);
    let extraInfo = '';
    if (special) extraInfo = `\n\n🏷️ ${special.badge}: ${special.desc}`;
    if (item.isComboItem && item.comboItems?.length) {
      extraInfo += `\n\n📦 Combo items:\n` +
        item.comboItems.map(ci => `  • ${ci.quantity}× ${ci.productName}`).join('\n');
    }

    Alert.alert(
      'Confirm Pick',
      `${item.name}${item.variantName ? ` — ${item.variantName}` : ''}\n` +
      `SKU: ${item.sku}  |  Qty: ${item.quantity}${extraInfo}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Picked', onPress: () => markScanned(scanKey) },
      ]
    );
  };

  // Mark a scan key as done
  const markScanned = (key: string) => {
    setScanned(prev => new Set([...prev, key]));
  };

  // Find the first un-scanned slot for a given item (handles duplicate products)
  const findUnscannedKey = (item: OrderItem): string | null => {
    let globalIdx = 0;
    for (const grp of groups) {
      for (const grpItem of grp.items) {
        const key = itemScanKey(grpItem, globalIdx);
        if (
          grpItem.productId === item.productId &&
          grpItem.variantName === item.variantName &&
          !scanned.has(key)
        ) {
          return key;
        }
        globalIdx++;
      }
    }
    return null;
  };

  // ── Complete picking ─────────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!order) return;

    const unpicked = allScanKeys.filter(k => !scanned.has(k));
    if (unpicked.length > 0) {
      // Build a human-readable list of what's missing
      const missing: string[] = [];
      let globalIdx = 0;
      for (const grp of groups) {
        for (const item of grp.items) {
          const key = itemScanKey(item, globalIdx);
          if (!scanned.has(key)) {
            missing.push(`• ${item.name}${item.variantName ? ` (${item.variantName})` : ''} ×${item.quantity}`);
          }
          globalIdx++;
        }
      }
      Alert.alert(
        `${unpicked.length} Item${unpicked.length > 1 ? 's' : ''} Not Picked`,
        `Please pick all items before continuing:\n\n${missing.join('\n')}`,
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    try {
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'packaging', packagingStartedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err: any) {
      console.error('Status update failed:', err.response?.data || err.message);
    }

    navigation.navigate('Packaging', {
      orderId,
      orderNumber: order.orderNumber,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order…</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#999" />
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickedCount  = scanned.size;
  const totalCount   = allScanKeys.length;
  const progress     = totalCount > 0 ? pickedCount / totalCount : 0;
  const allPicked    = pickedCount === totalCount;

  // Per-group scan keys (in group order)
  const groupScanKeys: string[][] = [];
  let globalIdx = 0;
  for (const grp of groups) {
    const keys: string[] = [];
    for (let i = 0; i < grp.items.length; i++) {
      keys.push(itemScanKey(grp.items[i], globalIdx));
      globalIdx++;
    }
    groupScanKeys.push(keys);
  }

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backPress}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
          {order.customerInfo?.name && (
            <Text style={styles.customerName}>👤 {order.customerInfo.name}</Text>
          )}
        </View>
      </View>

      {/* ── Status stepper ─────────────────────────────────────────────── */}
      <StatusStepper currentStatus={order.status} />

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>
            {pickedCount} of {totalCount} items picked
          </Text>
          <Text style={[styles.progressPct, allPicked && { color: '#10b981' }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Breakdown chips */}
        <View style={styles.chipRow}>
          {groups.map((grp, gi) => {
            const keys  = groupScanKeys[gi];
            const done  = keys.filter(k => scanned.has(k)).length;
            const total = keys.length;
            const allGrpDone = done === total;
            return (
              <View
                key={grp.key}
                style={[styles.chip, { borderColor: grp.borderColor, backgroundColor: grp.bgColor }]}
              >
                <grp.Icon size={12} color={allGrpDone ? '#10b981' : grp.color} />
                <Text style={[styles.chipText, { color: allGrpDone ? '#10b981' : grp.color }]}>
                  {grp.key === 'regular' ? 'Reg' :
                   grp.key === 'special' ? 'Promo' :
                   grp.key === 'combo'   ? 'Combo' : 'Bonus'} {done}/{total}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Groups ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((grp, gi) => (
          <GroupSection
            key={grp.key}
            group={grp}
            scanKeys={groupScanKeys[gi]}
            scannedSet={scanned}
            onScan={openScanner}
            onManual={handleManual}
          />
        ))}

        {/* Savings summary */}
        {(order.totalSavings || 0) > 0 && (
          <View style={styles.savingsCard}>
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.savingsText}>
              Customer saves <Text style={{ fontWeight: '800' }}>
                R{order.totalSavings!.toFixed(2)}
              </Text> with specials on this order
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Footer CTA ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeBtn, !allPicked && styles.completeBtnDisabled]}
          onPress={handleComplete}
          disabled={!allPicked}
        >
          <Ionicons name="arrow-forward" size={22} color="#fff" />
          <Text style={styles.completeBtnText}>
            {allPicked ? 'Continue to Packaging' : `Pick All Items First (${totalCount - pickedCount} left)`}
          </Text>
        </TouchableOpacity>

        {!allPicked && (
          <Text style={styles.footerHint}>
            Every item in every group must be scanned or manually confirmed
          </Text>
        )}
      </View>

      {/* ── Barcode scanner modal ───────────────────────────────────────── */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => { setScannerVisible(false); setCurrentItem(null); }}
        onScan={handleBarcodeScanned}
      />
    </View>
  );
}

// ─── Enrich items with live product data ──────────────────────────────────────
async function enrichItems(items: OrderItem[], token: string | null): Promise<OrderItem[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const res = await axios.get(`${API_URL}/api/products/${item.productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const p = res.data.product || res.data;
        return {
          ...item,
          barcode:     p.barcode     || item.barcode,
          image:       p.image       || item.image,
        };
      } catch {
        return item;
      }
    })
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#666' },
  errorText:   { fontSize: 16, color: '#999', marginTop: 12 },

  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backPress: { paddingRight: 8 },
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  customerName: { fontSize: 13, color: '#666', marginTop: 2 },

  backBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  backBtnText: { color: '#FF6B35', fontWeight: '600' },

  progressWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  progressPct:   { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  progressTrack: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 5,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

  scrollContent: { padding: 16 },

  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 8,
  },
  savingsText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  completeBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FF6B35',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  completeBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footerHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 8,
  },
});

// ─── Group section styles ─────────────────────────────────────────────────────
const gs = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  progress: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  progressDone: { backgroundColor: '#d1fae5' },
  progressText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  progressTextDone: { color: '#065f46' },
});

// ─── Item card styles ─────────────────────────────────────────────────────────
const ic = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    margin: 8,
    marginTop: 0,
    position: 'relative',
  },
  cardScanned: { backgroundColor: '#f0fdf4', borderColor: '#10b981' },

  scannedBanner: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 1,
  },
  scannedBannerText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  row: { flexDirection: 'row', gap: 12 },
  img: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#f3f4f6' },
  imgFb: { alignItems: 'center', justifyContent: 'center' },

  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },
  variant: { fontWeight: '400', color: '#6b7280' },
  sku: { fontSize: 11, color: '#9ca3af', marginTop: 2, marginBottom: 4 },

  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  badgeDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  comboBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  comboBoxTitle: { fontSize: 11, fontWeight: '700', color: '#6d28d9', marginBottom: 4 },
  comboRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  comboQtyDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboQtyText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  comboItemName: { fontSize: 12, color: '#5b21b6', flex: 1 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  qtyPill: {
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  qtyText: { color: '#FF6B35', fontSize: 12, fontWeight: '700' },
  origPrice: { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  price: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  priceFree: { color: '#10b981' },

  barcodeCol: { width: 28, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  barcodeHas: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeNone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  scanBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  manualBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  noBarcodeWarn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noBarcodeText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
});