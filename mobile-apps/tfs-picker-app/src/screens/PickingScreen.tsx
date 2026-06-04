// src/screens/PickingScreen.tsx
// Offline-first: every pick action is written to AsyncStorage before hitting
// the network. If offline, actions are enqueued and flushed on reconnect.
// Buttons show loading states to prevent double-press.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Gift, Tag, Package as PackageIcon, ShoppingBag, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, Layers, Star, XCircle, AlertCircle, WifiOff,
} from 'lucide-react-native';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';
import StatusStepper from '../components/StatusStepper';
import { useAppModal } from '../components/AppModal';
import { logHandlingEvent } from '../lib/handlingLog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  enqueueAction,
  cacheOrder,
  getCachedOrder,
  flushQueue,
  getPendingCount,
} from '../services/offlineSync';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Offline persistence for pick progress ────────────────────────────────────
// Survives hard-close: pick counts and OOS flags are written to AsyncStorage
// after every action, and restored when the screen mounts.

const PICK_COUNTS_KEY = (orderId: string) => `pick_counts:${orderId}`;
const OOS_KEY         = (orderId: string) => `oos_items:${orderId}`;

async function loadPickCounts(orderId: string): Promise<PickCounts> {
  try {
    const raw = await AsyncStorage.getItem(PICK_COUNTS_KEY(orderId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function savePickCounts(orderId: string, counts: PickCounts): Promise<void> {
  try { await AsyncStorage.setItem(PICK_COUNTS_KEY(orderId), JSON.stringify(counts)); }
  catch { /* non-fatal */ }
}

async function loadOOS(orderId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(OOS_KEY(orderId));
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch { return new Set<string>(); }
}

async function saveOOS(orderId: string, set: Set<string>): Promise<void> {
  try { await AsyncStorage.setItem(OOS_KEY(orderId), JSON.stringify(Array.from(set))); }
  catch { /* non-fatal */ }
}

async function clearPickStorage(orderId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([PICK_COUNTS_KEY(orderId), OOS_KEY(orderId)]);
  } catch { /* non-fatal */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: string; name: string; sku: string; quantity: number;
  price: number; barcode?: string; image?: string; variantName?: string; variantId?: string;
  appliedSpecialId?: string; specialType?: string; specialConditions?: any;
  specialDescription?: string; specialDiscount?: number; originalPrice?: number;
  isBonusItem?: boolean; isFreeItem?: boolean; isMultibuyBonus?: boolean;
  autoAdded?: boolean; linkedToItemId?: string;
  isComboItem?: boolean; comboId?: string; comboName?: string;
  comboItems?: Array<{ productId: string; productName: string; quantity: number; sku?: string; barcode?: string; image?: string }>;
  _flattenedFromCombo?: boolean; _comboParentName?: string;
  stockLevel?: number; lowStockThreshold?: number;
}

interface Order {
  _id: string; orderNumber: string; items: OrderItem[];
  status: string; total: number; subtotal?: number; totalSavings?: number;
  customerInfo?: { name: string; phone?: string }; shippingAddress?: any;
}

type GroupKey = 'regular' | 'special' | 'combo' | 'bonus';
interface ItemGroup {
  key: GroupKey; title: string; subtitle: string;
  color: string; bgColor: string; borderColor: string;
  Icon: React.FC<any>; items: OrderItem[];
}
type PickCounts = Record<string, number>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenItems(items: OrderItem[]): OrderItem[] {
  const result: OrderItem[] = [];
  for (const item of items) {
    if (item.isComboItem && item.comboItems && item.comboItems.length > 0) {
      for (const ci of item.comboItems) {
        result.push({
          productId: ci.productId, name: ci.productName,
          sku: ci.sku || ci.productId, quantity: ci.quantity, price: 0,
          barcode: ci.barcode, image: ci.image,
          isBonusItem: false, isFreeItem: false, isComboItem: false,
          _flattenedFromCombo: true, _comboParentName: item.comboName || item.name,
        });
      }
    } else { result.push(item); }
  }
  return result;
}

function classifyItems(items: OrderItem[]): ItemGroup[] {
  const flattened = flattenItems(items);
  const regular: OrderItem[] = [], special: OrderItem[] = [], combo: OrderItem[] = [], bonus: OrderItem[] = [];
  for (const item of flattened) {
    if (item._flattenedFromCombo) combo.push(item);
    else if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) bonus.push(item);
    else if (item.specialType || item.appliedSpecialId) special.push(item);
    else regular.push(item);
  }
  const groups: ItemGroup[] = [];
  if (regular.length) groups.push({ key: 'regular', title: 'Regular Items',         subtitle: `${regular.length} item${regular.length !== 1 ? 's' : ''} - scan each one`,                    color: '#1a1a1a', bgColor: '#f9fafb', borderColor: '#e5e7eb', Icon: ShoppingBag, items: regular });
  if (special.length) groups.push({ key: 'special', title: 'Special / Promo Items', subtitle: `${special.length} item${special.length !== 1 ? 's' : ''} - discounted, must all be scanned`, color: '#b45309', bgColor: '#fffbeb', borderColor: '#fde68a', Icon: Tag,         items: special });
  if (combo.length)   groups.push({ key: 'combo',   title: 'Combo Deal Items',      subtitle: `${combo.length} individual item${combo.length !== 1 ? 's' : ''} from combo bundles`,           color: '#6d28d9', bgColor: '#f5f3ff', borderColor: '#c4b5fd', Icon: Layers,      items: combo   });
  if (bonus.length)   groups.push({ key: 'bonus',   title: ' Free / Bonus Items',   subtitle: `${bonus.length} item${bonus.length !== 1 ? 's' : ''} - MUST be included`,                     color: '#065f46', bgColor: '#ecfdf5', borderColor: '#6ee7b7', Icon: Gift,        items: bonus   });
  return groups;
}

function itemScanKey(item: OrderItem, index: number): string {
  return `${item.productId}__${item.variantName || ''}__${index}`;
}

function getSpecialLabel(item: OrderItem): { badge: string; desc: string; color: string; bg: string } | null {
  if (item._flattenedFromCombo) return { badge: 'COMBO', desc: `From "${item._comboParentName}"`, color: '#6d28d9', bg: '#ede9fe' };
  if (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded) return { badge: 'FREE', desc: 'Bonus item - include at no charge', color: '#065f46', bg: '#d1fae5' };
  if (!item.specialType) return null;
  switch (item.specialType) {
    case 'percentage_off': { const p = item.specialConditions?.discountPercentage; return { badge: `${p}% OFF`, desc: `${p}% discount applied`, color: '#92400e', bg: '#fef3c7' }; }
    case 'amount_off':     { const a = item.specialConditions?.discountAmount; return { badge: `R${a} OFF`, desc: `R${a} discount applied`, color: '#92400e', bg: '#fef3c7' }; }
    case 'fixed_price':    { const pr = item.specialConditions?.newPrice; return { badge: 'SPECIAL PRICE', desc: `Special price: R${pr}`, color: '#92400e', bg: '#fef3c7' }; }
    case 'multibuy':       { const q = item.specialConditions?.requiredQuantity, sp = item.specialConditions?.specialPrice; return { badge: 'MULTIBUY', desc: `${q} for R${sp}`, color: '#1d4ed8', bg: '#dbeafe' }; }
    case 'buy_x_get_y':    { const bq = item.specialConditions?.buyQuantity, gq = item.specialConditions?.getQuantity, d = item.specialConditions?.getDiscount || 100; return { badge: 'BUY X GET Y', desc: d === 100 ? `Buy ${bq}, get ${gq} FREE` : `Buy ${bq}, get ${gq} at ${d}% off`, color: '#065f46', bg: '#d1fae5' }; }
    case 'bundle': return { badge: 'BUNDLE', desc: item.specialDescription || 'Bundle deal', color: '#6d28d9', bg: '#ede9fe' };
    default: return { badge: 'SPECIAL', desc: item.specialDescription || 'Special offer', color: '#92400e', bg: '#fef3c7' };
  }
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: OrderItem; scanKey: string; pickCount: number; isOOS: boolean;
  onManual: (item: OrderItem, scanKey: string) => void;
  onOOS: (item: OrderItem, scanKey: string) => void;
  groupColor: string; groupBg: string; isScanModeActive: boolean;
  // Loading states per-button to prevent double-press
  isManualLoading: boolean;
  isOOSLoading: boolean;
}

function ItemCard({
  item, scanKey, pickCount, isOOS, onManual, onOOS,
  groupColor, groupBg, isScanModeActive, isManualLoading, isOOSLoading,
}: ItemCardProps) {
  const special    = getSpecialLabel(item);
  const isFreeType = item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded;
  const lineTotal  = isFreeType ? 0 : item.price * item.quantity;
  const lowStock   = item.stockLevel !== undefined && item.lowStockThreshold !== undefined && item.stockLevel <= item.lowStockThreshold;
  const isDone     = pickCount >= item.quantity;
  const remaining  = item.quantity - pickCount;
  const hasPartial = pickCount > 0 && !isDone;
  const borderColor = isOOS ? '#ef4444' : isDone ? '#10b981' : hasPartial ? '#f59e0b' : groupColor + '55';

  return (
    <View style={[ic.card, { borderColor }, isDone && !isOOS && ic.cardScanned, isOOS && ic.cardOOS]}>
      {isDone && !isOOS && <View style={ic.scannedBanner}><CheckCircle size={14} color="#fff" /><Text style={ic.scannedBannerText}>PICKED</Text></View>}
      {isOOS && <View style={ic.oosBanner}><XCircle size={14} color="#fff" /><Text style={ic.oosBannerText}>OUT OF STOCK</Text></View>}
      {hasPartial && <View style={ic.partialBanner}><Text style={ic.partialBannerText}>{pickCount}/{item.quantity} PICKED</Text></View>}
      {lowStock && !isDone && !isOOS && <View style={ic.lowStockBadge}><AlertCircle size={12} color="#f59e0b" /><Text style={ic.lowStockText}>Low stock - verify count</Text></View>}
      <View style={ic.row}>
        {item.image
          ? <Image source={{ uri: item.image }} style={ic.img} />
          : <View style={[ic.img, ic.imgFb, { backgroundColor: groupBg }]}><PackageIcon size={22} color={groupColor} /></View>}
        <View style={ic.info}>
          <Text style={ic.name} numberOfLines={2}>{item.name}{item.variantName ? <Text style={ic.variant}> - {item.variantName}</Text> : null}</Text>
          <Text style={ic.sku}>SKU: {item.sku}</Text>
          {special && <View style={[ic.badge, { backgroundColor: special.bg }]}><Text style={[ic.badgeText, { color: special.color }]}>{special.badge}</Text><Text style={[ic.badgeDesc, { color: special.color }]}>{special.desc}</Text></View>}
          <View style={ic.priceRow}>
            <View style={[ic.qtyPill, hasPartial && ic.qtyPillPartial, isDone && ic.qtyPillDone]}>
              <Text style={[ic.qtyText, hasPartial && ic.qtyTextPartial, isDone && ic.qtyTextDone]}>
                {isDone ? `✓ ${item.quantity}` : hasPartial ? `${pickCount}/${item.quantity}` : `×${item.quantity}`}
              </Text>
            </View>
            {item.originalPrice && item.originalPrice !== item.price && <Text style={ic.origPrice}>R{(item.originalPrice * item.quantity).toFixed(2)}</Text>}
            <Text style={[ic.price, lineTotal === 0 && ic.priceFree]}>{lineTotal === 0 ? 'FREE' : `R${lineTotal.toFixed(2)}`}</Text>
          </View>
        </View>
        <View style={ic.barcodeCol}>
          {item.barcode
            ? <View style={ic.barcodeHas}><Ionicons name="barcode" size={16} color="#10b981" /></View>
            : <View style={ic.barcodeNone}><Ionicons name="warning-outline" size={16} color="#f59e0b" /></View>}
        </View>
      </View>
      {!isDone && !isOOS && (
        <View style={ic.actions}>
          {item.barcode ? (
            <View style={[ic.scanHint, isScanModeActive && ic.scanHintActive]}>
              <Ionicons name="barcode-outline" size={16} color={isScanModeActive ? '#fff' : '#FF6B35'} />
              <Text style={[ic.scanHintText, isScanModeActive && ic.scanHintTextActive]}>
                {isScanModeActive ? `Scan mode active — scan barcode (${remaining} left)` : 'Enable scan mode or use manual'}
              </Text>
            </View>
          ) : (
            <View style={ic.noBarcodeWarn}><Ionicons name="warning-outline" size={15} color="#f59e0b" /><Text style={ic.noBarcodeText}>No barcode - use manual confirm</Text></View>
          )}
          {/* +1 manual button — shows spinner while in-flight */}
          <TouchableOpacity
            style={[ic.manualBtn, isManualLoading && ic.btnLoading]}
            onPress={() => !isManualLoading && !isOOSLoading && onManual(item, scanKey)}
            disabled={isManualLoading || isOOSLoading}
          >
            {isManualLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={ic.manualBtnText}>+1</Text></>}
          </TouchableOpacity>
          {/* OOS button — shows spinner while in-flight */}
          <TouchableOpacity
            style={[ic.oosBtn, isOOSLoading && ic.btnLoading]}
            onPress={() => !isManualLoading && !isOOSLoading && onOOS(item, scanKey)}
            disabled={isManualLoading || isOOSLoading}
          >
            {isOOSLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <XCircle size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}
      {isOOS && <View style={ic.oosNote}><AlertTriangle size={14} color="#ef4444" /><Text style={ic.oosNoteText}>Refund will be issued. Stock take created for verification.</Text></View>}
    </View>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: ItemGroup; scanKeys: string[]; pickCounts: PickCounts; oosSet: Set<string>;
  onManual: (item: OrderItem, scanKey: string) => void;
  onOOS: (item: OrderItem, scanKey: string) => void;
  isScanModeActive: boolean;
  loadingKeys: Set<string>;   // keys currently being processed — format: `${scanKey}:manual` or `${scanKey}:oos`
}

function GroupSection({ group, scanKeys, pickCounts, oosSet, onManual, onOOS, isScanModeActive, loadingKeys }: GroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const doneCount = group.items.filter((item, idx) => { const key = scanKeys[idx]; return oosSet.has(key) || (pickCounts[key] ?? 0) >= item.quantity; }).length;
  const allDone = doneCount === group.items.length;
  return (
    <View style={[gs.wrapper, { borderColor: group.borderColor }]}>
      <TouchableOpacity style={[gs.header, { backgroundColor: group.bgColor }]} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={[gs.iconWrap, { backgroundColor: group.color + '20' }]}><group.Icon size={20} color={group.color} /></View>
        <View style={{ flex: 1 }}><Text style={[gs.title, { color: group.color }]}>{group.title}</Text><Text style={gs.subtitle}>{group.subtitle}</Text></View>
        <View style={[gs.progress, allDone && gs.progressDone]}><Text style={[gs.progressText, allDone && gs.progressTextDone]}>{doneCount}/{group.items.length}</Text></View>
        {expanded ? <ChevronUp size={18} color={group.color} /> : <ChevronDown size={18} color={group.color} />}
      </TouchableOpacity>
      {expanded && group.items.map((item, idx) => (
        <ItemCard
          key={scanKeys[idx]}
          item={item}
          scanKey={scanKeys[idx]}
          pickCount={pickCounts[scanKeys[idx]] ?? 0}
          isOOS={oosSet.has(scanKeys[idx])}
          onManual={onManual}
          onOOS={onOOS}
          groupColor={group.color}
          groupBg={group.bgColor}
          isScanModeActive={isScanModeActive}
          isManualLoading={loadingKeys.has(`${scanKeys[idx]}:manual`)}
          isOOSLoading={loadingKeys.has(`${scanKeys[idx]}:oos`)}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PickingScreen({ route, navigation: navProp }: any) {
  const { orderId } = route.params;
  const { token, user } = useAuthStore();
  const navigation  = navProp as any;
  const { showModal } = useAppModal();
  const insets = useSafeAreaInsets();

  const [order, setOrder]             = useState<Order | null>(null);
  const [groups, setGroups]           = useState<ItemGroup[]>([]);
  const [allScanKeys, setAllScanKeys] = useState<string[]>([]);
  const [pickCounts, setPickCounts]   = useState<PickCounts>({});
  const [oos, setOos]                 = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [scannerVisible, setScannerVisible]   = useState(false);
  const [isOnline, setIsOnline]               = useState(true);
  const [pendingCount, setPendingCount]       = useState(0);
  const [completeLoading, setCompleteLoading] = useState(false);
  // Per-button loading set: `${scanKey}:manual` or `${scanKey}:oos`
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  const barcodeLookup = useRef<Map<string, string[]>>(new Map());

  // ── Network monitor ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) { flushQueue().catch(() => {}); refreshPendingCount(); }
    });
    NetInfo.fetch().then(s => setIsOnline(!!s.isConnected));
    return () => unsub();
  }, []);

  const refreshPendingCount = async () => {
    const n = await getPendingCount();
    setPendingCount(n);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addLoadingKey    = (k: string) => setLoadingKeys(prev => new Set([...prev, k]));
  const removeLoadingKey = (k: string) => setLoadingKeys(prev => { const s = new Set(prev); s.delete(k); return s; });

  const buildBarcodeLookup = useCallback((grps: ItemGroup[], keys: string[]) => {
    const map = new Map<string, string[]>();
    let gi = 0;
    for (const grp of grps) {
      for (const item of grp.items) {
        const key = keys[gi];
        if (item.barcode) { const existing = map.get(item.barcode) ?? []; existing.push(key); map.set(item.barcode, existing); }
        gi++;
      }
    }
    barcodeLookup.current = map;
  }, []);

  // ── Fetch order (network first, cache fallback) ───────────────────────────
  const fetchOrder = useCallback(async () => {
    try {
      let orderData: Order;

      try {
        const res = await axios.get(`${API_URL}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });
        orderData = res.data.order;
        await cacheOrder(orderData as any);
      } catch {
        // Network error — try cache
        const cached = await getCachedOrder(orderId);
        if (!cached) {
          showModal({ title: 'Error', message: 'Failed to load order and no offline copy available.', buttons: [{ text: 'OK' }] });
          setLoading(false);
          return;
        }
        orderData = cached as unknown as Order;
      }

      orderData = { ...orderData, items: await enrichItems(orderData.items, token) };
      setOrder(orderData);
      const g = classifyItems(orderData.items);
      setGroups(g);
      const keys: string[] = [];
      let gi = 0;
      for (const grp of g) { for (const item of grp.items) { keys.push(itemScanKey(item, gi)); gi++; } }
      setAllScanKeys(keys);
      buildBarcodeLookup(g, keys);

      // ── Restore persisted pick progress (hard-close recovery) ───────────
      const [savedCounts, savedOOS] = await Promise.all([
        loadPickCounts(orderId),
        loadOOS(orderId),
      ]);
      if (Object.keys(savedCounts).length > 0) setPickCounts(savedCounts);
      if (savedOOS.size > 0) setOos(savedOOS);

      // ── Mark as picking (enqueue so it works offline too) ────────────────
      if (orderData.status === 'pending' || orderData.status === 'confirmed') {
        const patchPayload = {
          status:             'picking',
          pickingStartedAt:   new Date().toISOString(),
          assignedPickerId:   user?.id,
          assignedPickerName: user?.name,
        };
        await enqueueAction('picking_started' as any, orderId, patchPayload);
        // Also try live if online
        try {
          await axios.patch(`${API_URL}/api/orders/${orderId}`, patchPayload, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { /* will flush later */ }
        setOrder(prev => prev ? { ...prev, status: 'picking' } : prev);
      }
    } catch {
      showModal({ title: 'Error', message: 'Failed to load order', buttons: [{ text: 'OK' }] });
    } finally {
      setLoading(false);
      refreshPendingCount();
    }
  }, [orderId, token, user, buildBarcodeLookup]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // ── Pick action — optimistic update, then enqueue ─────────────────────────
  const incrementPick = useCallback(async (key: string, item: OrderItem) => {
    // Optimistic update immediately — UI responds instantly
    setPickCounts(prev => {
      const next = { ...prev, [key]: (prev[key] ?? 0) + 1 };
      // Persist asynchronously (don't block UI)
      savePickCounts(orderId, next).catch(() => {});
      return next;
    });

    // Enqueue the sync action (fires immediately if online, queues if offline)
    await enqueueAction('item_picked' as any, orderId, {
      sku: item.sku, productId: item.productId, scanKey: key,
    });

    // Accountability log (best-effort, network only)
    if (token) {
      logHandlingEvent(orderId, {
        eventType: 'item_picked_manual',
        itemSku:   item.sku,
        itemName:  item.name,
        scanKey:   key,
      }, token);
    }

    refreshPendingCount();
  }, [orderId, token]);

  // ── Manual +1 with loading state ─────────────────────────────────────────
  const handleManual = useCallback((item: OrderItem, scanKey: string) => {
    const current   = pickCounts[scanKey] ?? 0;
    const remaining = item.quantity - current;
    const special   = getSpecialLabel(item);
    let extraInfo   = special ? `\n\n${special.badge}: ${special.desc}` : '';
    const lowStock  = item.stockLevel !== undefined && item.lowStockThreshold !== undefined && item.stockLevel <= item.lowStockThreshold;
    if (lowStock) extraInfo += `\n\n⚠ Stock level is low (${item.stockLevel} units). A stock count is due.`;

    showModal({
      title: 'Confirm Pick (+1)',
      message: `${item.name}${item.variantName ? ` - ${item.variantName}` : ''}\nSKU: ${item.sku}\n\nPicked so far: ${current} / ${item.quantity} (${remaining} remaining)${extraInfo}`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm +1',
          onPress: async () => {
            const lk = `${scanKey}:manual`;
            addLoadingKey(lk);
            try {
              await incrementPick(scanKey, item);
            } finally {
              removeLoadingKey(lk);
            }
          },
        },
      ],
    });
  }, [pickCounts, incrementPick, showModal]);

  // ── OOS with loading state ────────────────────────────────────────────────
  const handleOOS = useCallback((item: OrderItem, scanKey: string) => {
    const refundAmount = (item.isBonusItem || item.isFreeItem || item.isMultibuyBonus || item.autoAdded || item._flattenedFromCombo) ? null : item.price * item.quantity;
    const refundLine   = refundAmount != null ? `The customer will be refunded R${refundAmount.toFixed(2)} for this item.` : 'This item is free - no refund required.';
    showModal({
      title: '⚠ Item Out of Stock?',
      message: `Are you sure "${item.name}${item.variantName ? ` - ${item.variantName}` : ''}" is out of stock?\n\n${refundLine}\n\nA stock-count record will be created for admin verification.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Out of Stock',
          style: 'destructive',
          onPress: async () => {
            const lk = `${scanKey}:oos`;
            addLoadingKey(lk);
            try {
              await confirmOOS(item, scanKey, refundAmount);
            } finally {
              removeLoadingKey(lk);
            }
          },
        },
      ],
    });
  }, [showModal]);

  const confirmOOS = useCallback(async (item: OrderItem, scanKey: string, refundAmount: number | null) => {
    // Optimistic update
    setOos(prev => {
      const next = new Set([...prev, scanKey]);
      saveOOS(orderId, next).catch(() => {});
      return next;
    });

    // Enqueue OOS action
    await enqueueAction('item_oos' as any, orderId, {
      sku: item.sku, productId: item.productId, variantId: item.variantId,
      scanKey, refundAmount, itemName: item.name,
    });

    if (token) {
      logHandlingEvent(orderId, {
        eventType: 'item_oos',
        itemSku:   item.sku,
        itemName:  item.name,
        scanKey,
        meta:      { refundAmount },
      }, token);
    }

    refreshPendingCount();
  }, [orderId, token]);

  // ── Barcode scan ─────────────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(async (scannedBarcode: string) => {
    setPickCounts(prev => {
      const matchingKeys = barcodeLookup.current.get(scannedBarcode) ?? [];
      const itemByKey    = new Map<string, OrderItem>();
      let gi = 0;
      for (const grp of groups) { for (const item of grp.items) { itemByKey.set(allScanKeys[gi], item); gi++; } }
      const eligible = matchingKeys.filter(k => { if (oos.has(k)) return false; const item = itemByKey.get(k); if (!item) return false; return (prev[k] ?? 0) < item.quantity; });
      if (eligible.length === 0) {
        setTimeout(() => { showModal({ title: 'Already Picked', message: 'All units for this barcode have already been picked.', buttons: [{ text: 'OK' }] }); }, 0);
        return prev;
      }
      eligible.sort((a, b) => (prev[b] ?? 0) - (prev[a] ?? 0));
      const bestKey  = eligible[0];
      const bestItem = itemByKey.get(bestKey)!;
      const newCount = (prev[bestKey] ?? 0) + 1;
      const isDone   = newCount >= bestItem.quantity;

      const next = { ...prev, [bestKey]: newCount };
      savePickCounts(orderId, next).catch(() => {});

      setTimeout(async () => {
        await enqueueAction('item_picked' as any, orderId, {
          sku: bestItem.sku, productId: bestItem.productId, scanKey: bestKey,
        });
        if (token) {
          logHandlingEvent(orderId, {
            eventType: 'item_picked_barcode',
            itemSku:   bestItem.sku,
            itemName:  bestItem.name,
            scanKey:   bestKey,
          }, token);
        }
        refreshPendingCount();
        if (isDone) {
          showModal({
            title:   '✓ Item Picked',
            message: `${bestItem.name}${bestItem.variantName ? ` - ${bestItem.variantName}` : ''} — all ${bestItem.quantity} unit${bestItem.quantity !== 1 ? 's' : ''} picked!`,
            buttons: [{ text: 'OK' }],
          });
        }
      }, 0);

      return next;
    });
  }, [groups, allScanKeys, oos, orderId, token, showModal]);

  const handleBarcodeScannedWithFallback = useCallback(async (scannedBarcode: string) => {
    const allBarcodes = Array.from(barcodeLookup.current.keys());
    if (!allBarcodes.includes(scannedBarcode)) {
      try { const res = await axios.get(`${API_URL}/api/products?barcode=${scannedBarcode}`, { headers: { Authorization: `Bearer ${token}` } }); const productName = res.data.product?.name || 'Unknown product'; showModal({ title: '✗ Not in Order', message: `Scanned: ${productName}\n\nThis barcode is not part of this order.`, buttons: [{ text: 'OK' }] }); }
      catch { showModal({ title: '✗ Unknown Barcode', message: 'This barcode does not match any item in the order.', buttons: [{ text: 'OK' }] }); }
      return;
    }
    handleBarcodeScanned(scannedBarcode);
  }, [handleBarcodeScanned, showModal, token]);

  // ── Cancel order ─────────────────────────────────────────────────────────
  const cancelOrder = useCallback(async () => {
    setCompleteLoading(true);
    try {
      const payload = {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'All items out of stock during picking',
      };
      await enqueueAction('order_cancelled' as any, orderId, payload);
      try {
        await axios.patch(`${API_URL}/api/orders/${orderId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* queued */ }
      await clearPickStorage(orderId);
      showModal({
        title: 'Order Cancelled',
        message: 'The order has been cancelled. The customer will be refunded in full.',
        buttons: [{ text: 'OK', onPress: () => navigation.goBack() }],
      });
    } catch (err: any) {
      showModal({ title: 'Error', message: 'Failed to cancel the order. Please try again.', buttons: [{ text: 'OK' }] });
    } finally {
      setCompleteLoading(false);
    }
  }, [orderId, token, navigation, showModal]);

  // ── Getters ──────────────────────────────────────────────────────────────
  const getItem = (k: string) => { let gi = 0; for (const grp of groups) { for (const it of grp.items) { if (allScanKeys[gi] === k) return it; gi++; } return null; } return null; };

  // ── Advance to packaging ─────────────────────────────────────────────────
  const advanceToPackaging = useCallback(async () => {
    setCompleteLoading(true);
    try {
      const payload = { status: 'packaging', packagingStartedAt: new Date().toISOString() };
      await enqueueAction('packaging_started' as any, orderId, payload);
      try {
        await axios.patch(`${API_URL}/api/orders/${orderId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* queued */ }
      await clearPickStorage(orderId);
      navigation.navigate('Packaging', { orderId, orderNumber: order ? order.orderNumber : '' });
    } catch (err: any) {
      console.error('Status update failed:', err.response?.data || err.message);
      // Navigate anyway — the enqueued action will sync
      navigation.navigate('Packaging', { orderId, orderNumber: order ? order.orderNumber : '' });
    } finally {
      setCompleteLoading(false);
    }
  }, [orderId, token, order, navigation]);

  // ── Complete / validate ───────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (!order || completeLoading) return;

    const allOOS = allScanKeys.length > 0 && allScanKeys.every(k => oos.has(k));
    if (allOOS) {
      showModal({
        title: '⚠ All Items Out of Stock',
        message: 'Every item in this order is out of stock. The order will be cancelled and the customer will be fully refunded.',
        buttons: [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Cancel Order', style: 'destructive', onPress: () => cancelOrder() },
        ],
      });
      return;
    }

    const pending = allScanKeys.filter(k => { if (oos.has(k)) return false; const item = getItem(k); return !item || (pickCounts[k] ?? 0) < item!.quantity; });
    if (pending.length > 0) {
      const missing = pending.map(k => { const item = getItem(k); const picked = pickCounts[k] ?? 0; return item ? ` • ${item.name}${item.variantName ? ` (${item.variantName})` : ''} — ${picked}/${item.quantity} picked` : ''; }).filter(Boolean);
      showModal({ title: `${pending.length} Item${pending.length > 1 ? 's' : ''} Pending`, message: `Please finish picking or mark as OOS:\n\n${missing.join('\n')}`, buttons: [{ text: 'OK' }] });
      return;
    }
    const oosCount = oos.size;
    if (oosCount > 0) {
      showModal({ title: `${oosCount} OOS Item${oosCount > 1 ? 's' : ''}`, message: `${oosCount} item${oosCount > 1 ? 's were' : ' was'} marked out of stock. Refunds have been queued. Continue to packaging?`, buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => advanceToPackaging() }] });
    } else { advanceToPackaging(); }
  }, [order, allScanKeys, groups, pickCounts, oos, showModal, cancelOrder, completeLoading, advanceToPackaging]);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalUnits  = allScanKeys.reduce((sum, k) => sum + (getItem(k)?.quantity ?? 1), 0);
  const pickedUnits = allScanKeys.reduce((sum, k) => { if (oos.has(k)) return sum + (getItem(k)?.quantity ?? 1); return sum + (pickCounts[k] ?? 0); }, 0);
  const oosUnits    = allScanKeys.reduce((sum, k) => oos.has(k) ? sum + (getItem(k)?.quantity ?? 1) : sum, 0);
  const resolvedSlots = allScanKeys.filter(k => { if (oos.has(k)) return true; const item = getItem(k); return item ? (pickCounts[k] ?? 0) >= item.quantity : false; }).length;
  const progress        = totalUnits > 0 ? pickedUnits / totalUnits : 0;
  const allDone         = resolvedSlots === allScanKeys.length;
  const allOOSResolved  = allScanKeys.length > 0 && allScanKeys.every(k => oos.has(k));

  const groupScanKeys: string[][] = [];
  { let gi = 0; for (const grp of groups) { const keys: string[] = []; for (let i = 0; i < grp.items.length; i++) { keys.push(allScanKeys[gi]); gi++; } groupScanKeys.push(keys); } }

  const footerBottomPad = Math.max(insets.bottom, 16);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B35" /><Text style={styles.loadingText}>Loading order...</Text></View>;
  if (!order)  return <View style={styles.centered}><Ionicons name="alert-circle-outline" size={64} color="#999" /><Text style={styles.errorText}>Order not found</Text><TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Text style={styles.backBtnText}>← Go Back</Text></TouchableOpacity></View>;

  return (
    <View style={styles.container}>
      {/* ── Offline banner ─────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#92400e" />
          <Text style={styles.offlineBannerText}>Offline — picks are saved locally and will sync when reconnected.</Text>
        </View>
      )}
      {/* ── Pending sync indicator ────────────────────────────────────── */}
      {isOnline && pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color="#1d4ed8" />
          <Text style={styles.syncBannerText}>Syncing {pendingCount} pending action{pendingCount !== 1 ? 's' : ''}…</Text>
        </View>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backPress}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
          {order.customerInfo?.name && <Text style={styles.customerName}>👤 {order.customerInfo.name}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.scanToggle, scannerVisible && styles.scanToggleActive]}
          onPress={() => setScannerVisible(v => !v)}
        >
          <Ionicons name={scannerVisible ? 'barcode' : 'barcode-outline'} size={22} color={scannerVisible ? '#fff' : '#FF6B35'} />
          <Text style={[styles.scanToggleText, scannerVisible && styles.scanToggleTextActive]}>{scannerVisible ? 'Scanning…' : 'Scan'}</Text>
        </TouchableOpacity>
      </View>

      <StatusStepper currentStatus={order.status} />

      {/* ── Progress ─────────────────────────────────────────────────── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>{pickedUnits} of {totalUnits} units resolved</Text>
          {oos.size > 0 && <Text style={styles.oosCount}>{oosUnits} OOS</Text>}
          <Text style={[styles.progressPct, allDone && { color: '#10b981' }]}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(pickedUnits / Math.max(totalUnits, 1)) * 100}%` }]} />
          <View style={[styles.progressFillOOS, { width: `${(oosUnits / Math.max(totalUnits, 1)) * 100}%` }]} />
        </View>
        <View style={styles.chipRow}>
          {groups.map((grp, gi) => {
            const keys = groupScanKeys[gi];
            const done = grp.items.filter((item, idx) => { const k = keys[idx]; return oos.has(k) || (pickCounts[k] ?? 0) >= item.quantity; }).length;
            const allGrpDone = done === keys.length;
            return (
              <View key={grp.key} style={[styles.chip, { borderColor: grp.borderColor, backgroundColor: grp.bgColor }]}>
                <grp.Icon size={12} color={allGrpDone ? '#10b981' : grp.color} />
                <Text style={[styles.chipText, { color: allGrpDone ? '#10b981' : grp.color }]}>
                  {grp.key === 'regular' ? 'Reg' : grp.key === 'special' ? 'Promo' : grp.key === 'combo' ? 'Combo' : 'Bonus'} {done}/{keys.length}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerBottomPad + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        {scannerVisible && (
          <View style={styles.scanActiveBanner}>
            <Ionicons name="barcode-outline" size={18} color="#fff" />
            <Text style={styles.scanActiveBannerText}>Scan mode active — scan any item barcode to pick it. Each scan counts as 1 unit.</Text>
            <TouchableOpacity onPress={() => setScannerVisible(false)}><XCircle size={20} color="#fff" /></TouchableOpacity>
          </View>
        )}
        {oos.size > 0 && (
          <View style={[styles.refundBanner, allOOSResolved && styles.refundBannerAllOOS]}>
            <AlertTriangle size={16} color={allOOSResolved ? '#7f1d1d' : '#ef4444'} />
            <Text style={[styles.refundBannerText, allOOSResolved && styles.refundBannerTextAllOOS]}>
              {allOOSResolved
                ? '⚠ All items are out of stock — this order will be cancelled and the customer fully refunded.'
                : `${oos.size} item${oos.size > 1 ? 's' : ''} out of stock — refund${oos.size > 1 ? 's' : ''} will be issued to the customer`}
            </Text>
          </View>
        )}
        {groups.map((grp, gi) => (
          <GroupSection
            key={grp.key}
            group={grp}
            scanKeys={groupScanKeys[gi]}
            pickCounts={pickCounts}
            oosSet={oos}
            onManual={handleManual}
            onOOS={handleOOS}
            isScanModeActive={scannerVisible}
            loadingKeys={loadingKeys}
          />
        ))}
        {(order.totalSavings || 0) > 0 && (
          <View style={styles.savingsCard}>
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.savingsText}>Customer saves <Text style={{ fontWeight: '800' }}>R{(order.totalSavings || 0).toFixed(2)}</Text> with specials on this order</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
        <TouchableOpacity
          style={[
            styles.completeBtn,
            !allDone && styles.completeBtnDisabled,
            allOOSResolved && styles.completeBtnCancel,
            completeLoading && styles.completeBtnLoading,
          ]}
          onPress={handleComplete}
          disabled={!allDone || completeLoading}
        >
          {completeLoading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name={allOOSResolved ? 'close-circle' : 'arrow-forward'} size={22} color="#fff" />
                <Text style={styles.completeBtnText}>
                  {allOOSResolved
                    ? 'Cancel Order (All OOS)'
                    : allDone
                      ? `Continue to Packaging${!isOnline ? ' 📴' : ''}`
                      : `Resolve All Items (${totalUnits - pickedUnits} unit${totalUnits - pickedUnits !== 1 ? 's' : ''} left)`}
                </Text>
              </>}
        </TouchableOpacity>
        {!allDone && <Text style={styles.footerHint}>Pick items or mark them as out of stock to continue</Text>}
      </View>

      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleBarcodeScannedWithFallback} />
    </View>
  );
}

// ─── Enrich items with barcode / image from product API ──────────────────────

async function enrichItems(items: OrderItem[], token: string | null): Promise<OrderItem[]> {
  return Promise.all(items.map(async (item) => {
    try {
      const res = await axios.get(`${API_URL}/api/products/${item.productId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      const p = res.data.product || res.data;
      let stockLevel = p.stockLevel, lowStockThreshold = p.lowStockThreshold;
      if (item.variantId && p.variants) { const variant = p.variants.find((v: any) => v._id === item.variantId); if (variant) { stockLevel = variant.stockLevel; } }
      let enrichedComboItems = item.comboItems;
      if (item.comboItems && item.comboItems.length > 0) {
        enrichedComboItems = await Promise.all(item.comboItems.map(async (ci) => {
          try {
            const cr = await axios.get(`${API_URL}/api/products/${ci.productId}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
            const cp = cr.data.product || cr.data;
            return { ...ci, barcode: cp.barcode || ci.barcode, image: cp.images?.[0] || ci.image, sku: cp.sku || ci.sku };
          } catch { return ci; }
        }));
      }
      return { ...item, barcode: p.barcode || item.barcode, image: p.images?.[0] || item.image, stockLevel, lowStockThreshold, comboItems: enrichedComboItems };
    } catch { return item; }
  }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#666' },
  errorText:   { fontSize: 16, color: '#999', marginTop: 12 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  offlineBannerText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600' },

  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#bfdbfe',
  },
  syncBannerText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  header: {
    backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backPress: { paddingRight: 8 },
  backText:  { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitle:  { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  customerName: { fontSize: 13, color: '#666', marginTop: 2 },
  backBtn:     { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#FF6B35' },
  backBtnText: { color: '#FF6B35', fontWeight: '600' },

  scanToggle:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FF6B35', backgroundColor: '#fff' },
  scanToggleActive:    { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  scanToggleText:      { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  scanToggleTextActive:{ color: '#fff' },

  progressWrap: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  progressLabel:{ fontSize: 14, color: '#374151', fontWeight: '600', flex: 1 },
  oosCount:     { fontSize: 12, color: '#ef4444', fontWeight: '700', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  progressPct:  { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  progressTrack:{ height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', marginBottom: 10, flexDirection: 'row' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 5 },
  progressFillOOS: { height: '100%', backgroundColor: '#ef4444' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  chipText:{ fontSize: 11, fontWeight: '700' },

  scrollContent: { padding: 16 },

  scanActiveBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF6B35', borderRadius: 12, padding: 14, marginBottom: 12 },
  scanActiveBannerText: { flex: 1, fontSize: 13, color: '#fff', lineHeight: 18, fontWeight: '600' },

  refundBanner:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fee2e2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 12 },
  refundBannerText:        { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18, fontWeight: '600' },
  refundBannerAllOOS:      { backgroundColor: '#7f1d1d', borderColor: '#991b1b' },
  refundBannerTextAllOOS:  { color: '#fff' },

  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fde68a', marginTop: 8 },
  savingsText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingTop: 16, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  completeBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  completeBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  completeBtnCancel:   { backgroundColor: '#dc2626', shadowColor: '#dc2626' },
  completeBtnLoading:  { opacity: 0.8 },
  completeBtnText:     { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footerHint:          { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 8, marginBottom: 4 },
});

const gs = StyleSheet.create({
  wrapper:          { borderRadius: 16, borderWidth: 2, overflow: 'hidden', marginBottom: 16 },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title:            { fontSize: 15, fontWeight: '800' },
  subtitle:         { fontSize: 12, color: '#6b7280', marginTop: 2 },
  progress:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#e5e7eb', marginRight: 8 },
  progressDone:     { backgroundColor: '#d1fae5' },
  progressText:     { fontSize: 12, fontWeight: '700', color: '#374151' },
  progressTextDone: { color: '#065f46' },
});

const ic = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderWidth: 2, borderRadius: 12, padding: 14, margin: 8, marginTop: 0, position: 'relative' },
  cardScanned:{ backgroundColor: '#f0fdf4', borderColor: '#10b981' },
  cardOOS:    { backgroundColor: '#fff5f5', borderColor: '#ef4444' },

  scannedBanner:     { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  scannedBannerText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  oosBanner:         { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  oosBannerText:     { color: '#fff', fontSize: 10, fontWeight: '800' },
  partialBanner:     { position: 'absolute', top: 10, right: 10, backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  partialBannerText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  lowStockBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  lowStockText:      { color: '#92400e', fontSize: 11, fontWeight: '600' },

  row:   { flexDirection: 'row', gap: 12 },
  img:   { width: 70, height: 70, borderRadius: 10, backgroundColor: '#f3f4f6' },
  imgFb: { alignItems: 'center', justifyContent: 'center' },
  info:  { flex: 1 },
  name:  { fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },
  variant: { fontWeight: '400', color: '#6b7280' },
  sku:   { fontSize: 11, color: '#9ca3af', marginTop: 2, marginBottom: 4 },

  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  badgeDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  priceRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  qtyPill:        { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  qtyPillPartial: { backgroundColor: '#fef3c7' },
  qtyPillDone:    { backgroundColor: '#d1fae5' },
  qtyText:        { color: '#FF6B35', fontSize: 12, fontWeight: '700' },
  qtyTextPartial: { color: '#92400e' },
  qtyTextDone:    { color: '#065f46' },
  origPrice:      { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  price:          { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  priceFree:      { color: '#10b981' },

  barcodeCol:  { width: 28, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  barcodeHas:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  barcodeNone: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },

  scanHint:          { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff7ed', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa' },
  scanHintActive:    { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  scanHintText:      { color: '#FF6B35', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  scanHintTextActive:{ color: '#fff' },

  // Loading state for all action buttons
  btnLoading: { opacity: 0.6 },

  manualBtn:     { flex: 1, flexDirection: 'row', backgroundColor: '#374151', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 56 },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  oosBtn:        { width: 48, backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  noBarcodeWarn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fffbeb', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' },
  noBarcodeText: { color: '#92400e', fontSize: 12, fontWeight: '600' },

  oosNote:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, backgroundColor: '#fee2e2', borderRadius: 8 },
  oosNoteText: { flex: 1, fontSize: 12, color: '#991b1b', fontWeight: '500' },
});