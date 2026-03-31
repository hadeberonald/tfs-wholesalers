// src/screens/StockCountScreen.tsx
// Full stock count flow for the warehouse/picker app.
//
// Three modes in one screen:
//   1. PENDING COUNTS  - list of scheduled stock takes (including OOS-triggered ones)
//   2. COUNT SESSION   - scan or manually count items in a stock take
//   3. VERIFY OOS      - special flow for OOS-triggered takes: confirm 0 or correct the count

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, TextInput, ScrollView, Platform,
  RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ClipboardList, ScanLine, CheckCircle, AlertTriangle, Package,
  XCircle, ChevronRight, RefreshCw, Plus, Minus, Search,
  ShieldAlert,
} from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// Types --------------------------------------------------------------------

interface StockTake {
  _id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  expectedStock: number;
  countedStock?: number;
  variance?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  scheduledDate: string;
  triggeredByOOS?: boolean;
  triggeredByOrderNum?: string;
  notes?: string;
  barcode?: string;
}

type ScreenMode = 'list' | 'count' | 'verify_oos';

// Helpers ------------------------------------------------------------------

function isOverdue(st: StockTake) {
  return st.status === 'pending' && new Date(st.scheduledDate) < new Date();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// StockTake Card -----------------------------------------------------------

function StockTakeCard({ item, onPress }: { item: StockTake; onPress: () => void }) {
  const overdue = isOverdue(item);
  const isOOS   = item.triggeredByOOS;

  const borderColor = isOOS ? '#ef4444' : overdue ? '#f59e0b' : '#e5e7eb';
  const bgColor     = isOOS ? '#fff5f5' : overdue ? '#fffbeb' : '#fff';

  return (
    <TouchableOpacity style={[sc.card, { borderColor, backgroundColor: bgColor }]} onPress={onPress} activeOpacity={0.75}>
      <View style={sc.cardTop}>
        <View style={{ flex: 1 }}>
          {isOOS && (
            <View style={sc.oosPill}>
              <ShieldAlert size={11} color="#ef4444" />
              <Text style={sc.oosPillText}>OOS VERIFICATION REQUIRED</Text>
            </View>
          )}
          <Text style={sc.cardName} numberOfLines={2}>{item.productName}</Text>
          {item.variantName && <Text style={sc.cardVariant}>{item.variantName}</Text>}
          <Text style={sc.cardSku}>SKU: {item.sku}</Text>
          {isOOS && item.triggeredByOrderNum && (
            <Text style={sc.cardOrder}>From order #{item.triggeredByOrderNum}</Text>
          )}
        </View>
        <View style={sc.cardRight}>
          <View style={[sc.statusPill, { backgroundColor: isOOS ? '#fee2e2' : overdue ? '#fef3c7' : '#f3f4f6' }]}>
            {isOOS
              ? <XCircle size={12} color="#ef4444" />
              : overdue
              ? <AlertTriangle size={12} color="#f59e0b" />
              : <ClipboardList size={12} color="#6b7280" />
            }
            <Text style={[sc.statusText, { color: isOOS ? '#ef4444' : overdue ? '#b45309' : '#6b7280' }]}>
              {isOOS ? 'Verify OOS' : overdue ? 'Overdue' : 'Pending'}
            </Text>
          </View>
          <ChevronRight size={20} color="#9ca3af" style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={sc.cardBottom}>
        <View style={sc.statBox}>
          <Text style={sc.statLabel}>Expected</Text>
          <Text style={sc.statValue}>{item.expectedStock}</Text>
        </View>
        <View style={sc.statDivider} />
        <View style={sc.statBox}>
          <Text style={sc.statLabel}>Scheduled</Text>
          <Text style={sc.statValue}>{formatDate(item.scheduledDate)}</Text>
        </View>
        {item.barcode && (
          <>
            <View style={sc.statDivider} />
            <View style={sc.statBox}>
              <Ionicons name="barcode" size={14} color="#10b981" />
              <Text style={[sc.statLabel, { color: '#10b981' }]}>Has barcode</Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Main Screen --------------------------------------------------------------

export default function StockCountScreen({ navigation }: any) {
  const { token } = useAuthStore();

  const [mode, setMode]               = useState<ScreenMode>('list');
  const [stockTakes, setStockTakes]   = useState<StockTake[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<'all' | 'oos' | 'overdue'>('all');

  // Count session state
  const [activeTake, setActiveTake]   = useState<StockTake | null>(null);
  const [countedQty, setCountedQty]   = useState(0);
  const [countNotes, setCountNotes]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanCount, setScanCount]     = useState(0);

  // Fetch stock takes ------------------------------------------------------
  const fetchStockTakes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/stock-takes?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const takes: StockTake[] = res.data.stockTakes || [];
      const enriched = await Promise.all(takes.map(async (st) => {
        try {
          const pr = await axios.get(`${API_URL}/api/products/${st.productId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const p = pr.data.product || pr.data;
          let barcode = p.barcode;
          if (st.variantId && p.variants) {
            const v = p.variants.find((v: any) => v._id === st.variantId);
            if (v) barcode = v.barcode || barcode;
          }
          return { ...st, barcode };
        } catch {
          return st;
        }
      }));
      setStockTakes(enriched);
    } catch (err) {
      Alert.alert('Error', 'Failed to load stock counts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchStockTakes(); }, [fetchStockTakes]);

  // Open a count session ---------------------------------------------------
  const openTake = (st: StockTake) => {
    setActiveTake(st);
    setCountedQty(0);
    setScanCount(0);
    setCountNotes('');
    setMode(st.triggeredByOOS ? 'verify_oos' : 'count');
  };

  const closeSession = () => {
    setActiveTake(null);
    setMode('list');
    setScannerOpen(false);
  };

  // Barcode scan during count ----------------------------------------------
  const handleCountScan = (scannedBarcode: string) => {
    setScannerOpen(false);
    if (!activeTake) return;

    if (activeTake.barcode && scannedBarcode !== activeTake.barcode) {
      Alert.alert(
        'Wrong Item',
        `Scanned barcode does not match ${activeTake.productName}.\n\nExpected: ${activeTake.barcode}\nScanned: ${scannedBarcode}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setScanCount(prev => prev + 1);
    setCountedQty(prev => prev + 1);
  };

  // Submit count -----------------------------------------------------------
  const submitCount = async (confirmedZero = false) => {
    if (!activeTake) return;

    const finalQty = confirmedZero ? 0 : countedQty;
    const variance = finalQty - activeTake.expectedStock;

    if (!confirmedZero && Math.abs(variance) > 0) {
      const sign = variance > 0 ? '+' : '';
      const action = await new Promise<boolean>(resolve => {
        Alert.alert(
          `Variance: ${sign}${variance} units`,
          `Expected ${activeTake.expectedStock}, you counted ${finalQty}.\n\nThis will update the stock level in the database. Continue?`,
          [
            { text: 'Go Back', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm & Submit', onPress: () => resolve(true) },
          ]
        );
      });
      if (!action) return;
    }

    setSubmitting(true);
    try {
      await axios.put(
        `${API_URL}/api/stock-takes/${activeTake._id}`,
        {
          countedStock: finalQty,
          notes:        countNotes || (confirmedZero ? 'Picker confirmed: item is out of stock' : ''),
          status:       'completed',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const msg = confirmedZero
        ? `Stock confirmed as 0 for ${activeTake.productName}. Stock level updated.`
        : variance === 0
        ? `Stock count matches - ${finalQty} units confirmed.`
        : `Stock updated from ${activeTake.expectedStock} to ${finalQty} units (${variance > 0 ? '+' : ''}${variance}).`;

      Alert.alert('Count Submitted', msg, [
        {
          text: 'OK',
          onPress: () => {
            closeSession();
            fetchStockTakes(true);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit count');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list ----------------------------------------------------------
  const filtered = stockTakes
    .filter(st => {
      if (filter === 'oos') return st.triggeredByOOS;
      if (filter === 'overdue') return isOverdue(st);
      return true;
    })
    .filter(st =>
      !search.trim() ||
      st.productName.toLowerCase().includes(search.toLowerCase()) ||
      st.sku.toLowerCase().includes(search.toLowerCase())
    );

  const oosPending = stockTakes.filter(st => st.triggeredByOOS).length;
  const overdueCnt = stockTakes.filter(isOverdue).length;

  // ── RENDER: Count session ────────────────────────────────────────────────

  if (mode === 'count' && activeTake) {
    const variance = countedQty - activeTake.expectedStock;
    return (
      <View style={styles.container}>
        <View style={sess.header}>
          <TouchableOpacity onPress={closeSession} style={sess.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sess.headerTitle} numberOfLines={1}>{activeTake.productName}</Text>
            {activeTake.variantName && <Text style={sess.headerSub}>{activeTake.variantName}</Text>}
          </View>
          <View style={sess.skuPill}><Text style={sess.skuText}>{activeTake.sku}</Text></View>
        </View>

        <ScrollView contentContainerStyle={sess.body} keyboardShouldPersistTaps="handled">
          <View style={sess.statsRow}>
            <View style={sess.statCard}>
              <Text style={sess.statCardLabel}>Expected</Text>
              <Text style={sess.statCardValue}>{activeTake.expectedStock}</Text>
              <Text style={sess.statCardUnit}>units</Text>
            </View>
            <View style={[sess.statCard, { borderColor: variance < 0 ? '#ef4444' : variance > 0 ? '#10b981' : '#e5e7eb' }]}>
              <Text style={sess.statCardLabel}>Counted</Text>
              <Text style={[sess.statCardValue, { color: variance < 0 ? '#ef4444' : variance > 0 ? '#10b981' : '#1a1a1a' }]}>{countedQty}</Text>
              <Text style={sess.statCardUnit}>units</Text>
            </View>
            <View style={[sess.statCard, { borderColor: variance !== 0 ? '#f59e0b' : '#e5e7eb' }]}>
              <Text style={sess.statCardLabel}>Variance</Text>
              <Text style={[sess.statCardValue, { color: variance < 0 ? '#ef4444' : variance > 0 ? '#10b981' : '#6b7280' }]}>
                {variance > 0 ? '+' : ''}{variance}
              </Text>
              <Text style={sess.statCardUnit}>diff</Text>
            </View>
          </View>

          {scanCount > 0 && (
            <View style={sess.scanBadge}>
              <ScanLine size={16} color="#FF6B35" />
              <Text style={sess.scanBadgeText}>{scanCount} scan{scanCount !== 1 ? 's' : ''} recorded this session</Text>
            </View>
          )}

          <View style={sess.qtySection}>
            <Text style={sess.qtySectionTitle}>Counted Quantity</Text>
            <Text style={sess.qtySectionHint}>Scan barcodes to auto-increment, or adjust manually below</Text>
            <View style={sess.qtyRow}>
              <TouchableOpacity
                style={[sess.qtyBtn, countedQty === 0 && sess.qtyBtnDisabled]}
                onPress={() => setCountedQty(q => Math.max(0, q - 1))}
                disabled={countedQty === 0}
              >
                <Minus size={22} color={countedQty === 0 ? '#d1d5db' : '#1a1a1a'} />
              </TouchableOpacity>
              <TextInput
                style={sess.qtyInput}
                value={String(countedQty)}
                onChangeText={t => setCountedQty(Math.max(0, parseInt(t) || 0))}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TouchableOpacity style={sess.qtyBtn} onPress={() => setCountedQty(q => q + 1)}>
                <Plus size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={sess.scanBtn} onPress={() => setScannerOpen(true)}>
            <ScanLine size={20} color="#fff" />
            <Text style={sess.scanBtnText}>
              {activeTake.barcode ? 'Scan to Count (+1 per scan)' : 'Scan Any Barcode to Count'}
            </Text>
          </TouchableOpacity>

          {!activeTake.barcode && (
            <View style={sess.noBarcode}>
              <Ionicons name="warning-outline" size={14} color="#f59e0b" />
              <Text style={sess.noBarcodeText}>No barcode linked - any scan will count. Use manual entry for accuracy.</Text>
            </View>
          )}

          <View style={sess.notesSection}>
            <Text style={sess.qtySectionTitle}>Notes (optional)</Text>
            <TextInput
              style={sess.notesInput}
              value={countNotes}
              onChangeText={setCountNotes}
              placeholder="e.g. Found 3 damaged units, items in back storage..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={sess.footer}>
          <TouchableOpacity
            style={[sess.submitBtn, submitting && sess.submitBtnDisabled]}
            onPress={() => submitCount()}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <CheckCircle size={20} color="#fff" />
            }
            <Text style={sess.submitBtnText}>
              {submitting ? 'Submitting...' : `Submit Count (${countedQty} units)`}
            </Text>
          </TouchableOpacity>
        </View>

        <BarcodeScanner
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleCountScan}
        />
      </View>
    );
  }

  // ── RENDER: OOS Verification ─────────────────────────────────────────────

  if (mode === 'verify_oos' && activeTake) {
    const variance = countedQty - activeTake.expectedStock;
    return (
      <View style={styles.container}>
        <View style={[sess.header, { backgroundColor: '#ef4444' }]}>
          <TouchableOpacity onPress={closeSession} style={sess.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sess.headerTitle}>Verify Out-of-Stock</Text>
            <Text style={sess.headerSub}>{activeTake.productName}{activeTake.variantName ? ` - ${activeTake.variantName}` : ''}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={sess.body} keyboardShouldPersistTaps="handled">
          <View style={oosStyles.contextCard}>
            <ShieldAlert size={28} color="#ef4444" />
            <Text style={oosStyles.contextTitle}>OOS Reported During Picking</Text>
            <Text style={oosStyles.contextDesc}>
              A picker marked this item as out of stock on order #{activeTake.triggeredByOrderNum}.{'\n\n'}
              Please physically locate this product and count how many units are actually on the shelf.
            </Text>
            <View style={oosStyles.contextSku}>
              <Text style={oosStyles.contextSkuLabel}>SKU</Text>
              <Text style={oosStyles.contextSkuValue}>{activeTake.sku}</Text>
            </View>
            <View style={oosStyles.contextSku}>
              <Text style={oosStyles.contextSkuLabel}>System says</Text>
              <Text style={oosStyles.contextSkuValue}>{activeTake.expectedStock} units</Text>
            </View>
          </View>

          <View style={sess.statsRow}>
            <View style={sess.statCard}>
              <Text style={sess.statCardLabel}>System Stock</Text>
              <Text style={sess.statCardValue}>{activeTake.expectedStock}</Text>
              <Text style={sess.statCardUnit}>units</Text>
            </View>
            <View style={[sess.statCard, { borderColor: countedQty === 0 ? '#ef4444' : '#10b981' }]}>
              <Text style={sess.statCardLabel}>Your Count</Text>
              <Text style={[sess.statCardValue, { color: countedQty === 0 ? '#ef4444' : '#10b981' }]}>{countedQty}</Text>
              <Text style={sess.statCardUnit}>units</Text>
            </View>
          </View>

          <TouchableOpacity style={sess.scanBtn} onPress={() => setScannerOpen(true)}>
            <ScanLine size={20} color="#fff" />
            <Text style={sess.scanBtnText}>
              {activeTake.barcode ? 'Scan Item to Count' : 'Scan Any Barcode to Count'}
            </Text>
          </TouchableOpacity>

          {scanCount > 0 && (
            <View style={sess.scanBadge}>
              <ScanLine size={16} color="#FF6B35" />
              <Text style={sess.scanBadgeText}>{scanCount} scan{scanCount !== 1 ? 's' : ''} recorded</Text>
            </View>
          )}

          <View style={sess.qtySection}>
            <Text style={sess.qtySectionTitle}>Physical Count</Text>
            <View style={sess.qtyRow}>
              <TouchableOpacity
                style={[sess.qtyBtn, countedQty === 0 && sess.qtyBtnDisabled]}
                onPress={() => setCountedQty(q => Math.max(0, q - 1))}
                disabled={countedQty === 0}
              >
                <Minus size={22} color={countedQty === 0 ? '#d1d5db' : '#1a1a1a'} />
              </TouchableOpacity>
              <TextInput
                style={sess.qtyInput}
                value={String(countedQty)}
                onChangeText={t => setCountedQty(Math.max(0, parseInt(t) || 0))}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TouchableOpacity style={sess.qtyBtn} onPress={() => setCountedQty(q => q + 1)}>
                <Plus size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={sess.notesSection}>
            <Text style={sess.qtySectionTitle}>Notes</Text>
            <TextInput
              style={sess.notesInput}
              value={countNotes}
              onChangeText={setCountNotes}
              placeholder="e.g. Found 2 units at back, rest were damaged..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={oosStyles.actionRow}>
            <TouchableOpacity
              style={[oosStyles.actionBtn, oosStyles.actionBtnRed, submitting && sess.submitBtnDisabled]}
              onPress={() => {
                Alert.alert(
                  'Confirm Zero Stock',
                  `You found 0 units of "${activeTake.productName}". This will set the stock level to 0 in the system and confirm the OOS report.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Yes, Confirm Zero', style: 'destructive', onPress: () => submitCount(true) },
                  ]
                );
              }}
              disabled={submitting}
            >
              <XCircle size={20} color="#fff" />
              <Text style={oosStyles.actionBtnText}>Confirm Zero{'\n'}(OOS Validated)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[oosStyles.actionBtn, oosStyles.actionBtnGreen, (submitting || countedQty === 0) && sess.submitBtnDisabled]}
              onPress={() => {
                if (countedQty === 0) {
                  Alert.alert('No Count', 'Enter or scan the quantity you found, then tap this button.');
                  return;
                }
                submitCount(false);
              }}
              disabled={submitting || countedQty === 0}
            >
              <CheckCircle size={20} color="#fff" />
              <Text style={oosStyles.actionBtnText}>Found {countedQty} Units{'\n'}(Correct Stock)</Text>
            </TouchableOpacity>
          </View>

          <Text style={oosStyles.footerNote}>
            Either action will update the stock level in the database and close this verification.
            If stock was found, admin will be notified of the false OOS report.
          </Text>
        </ScrollView>

        <BarcodeScanner
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleCountScan}
        />
      </View>
    );
  }

  // ── RENDER: List ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={list.header}>
        <Text style={list.title}>Stock Counts</Text>
        <TouchableOpacity onPress={() => fetchStockTakes()} style={list.refreshBtn}>
          <RefreshCw size={18} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {oosPending > 0 && (
        <TouchableOpacity style={list.oosBanner} onPress={() => setFilter('oos')}>
          <ShieldAlert size={18} color="#ef4444" />
          <Text style={list.oosBannerText}>
            {oosPending} OOS verification{oosPending !== 1 ? 's' : ''} waiting - tap to filter
          </Text>
          <ChevronRight size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
      {overdueCnt > 0 && (
        <TouchableOpacity style={list.overdueBanner} onPress={() => setFilter('overdue')}>
          <AlertTriangle size={16} color="#b45309" />
          <Text style={list.overdueBannerText}>{overdueCnt} overdue count{overdueCnt !== 1 ? 's' : ''}</Text>
          <ChevronRight size={16} color="#b45309" />
        </TouchableOpacity>
      )}

      <View style={list.searchRow}>
        <View style={list.searchBox}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            style={list.searchInput}
            placeholder="Search by product or SKU..."
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={list.filterRow}>
        {(['all', 'oos', 'overdue'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[list.filterChip, filter === f && list.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[list.filterChipText, filter === f && list.filterChipTextActive]}>
              {f === 'all' ? `All (${stockTakes.length})` : f === 'oos' ? `OOS (${oosPending})` : `Overdue (${overdueCnt})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading stock counts...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <ClipboardList size={56} color="#d1d5db" />
          <Text style={list.emptyTitle}>
            {filter === 'oos' ? 'No OOS verifications pending' : filter === 'overdue' ? 'No overdue counts' : 'No pending stock counts'}
          </Text>
          <Text style={list.emptySubtitle}>Check back later or ask your admin to schedule counts</Text>
          {filter !== 'all' && (
            <TouchableOpacity style={list.clearFilter} onPress={() => setFilter('all')}>
              <Text style={list.clearFilterText}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => <StockTakeCard item={item} onPress={() => openTake(item)} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStockTakes(); }} tintColor="#FF6B35" />}
          ListHeaderComponent={
            filtered.some(st => st.triggeredByOOS) && filter === 'all' ? (
              <View style={list.sectionLabel}>
                <ShieldAlert size={14} color="#ef4444" />
                <Text style={list.sectionLabelText}>OOS VERIFICATIONS FIRST</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 15, color: '#666' },
});

const list = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingTop:      Platform.OS === 'ios' ? 60 : 40,
    paddingBottom:   16,
    paddingHorizontal: 20,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title:      { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  refreshBtn: { padding: 8, backgroundColor: '#fff7f3', borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa' },
  oosBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fee2e2', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#fca5a5',
  },
  oosBannerText: { flex: 1, fontSize: 13, color: '#991b1b', fontWeight: '700' },
  overdueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  overdueBannerText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  filterChipText:       { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#fff' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionLabelText: { fontSize: 11, fontWeight: '800', color: '#ef4444', letterSpacing: 0.5 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  clearFilter: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#FF6B35' },
  clearFilterText: { color: '#FF6B35', fontWeight: '700' },
});

const sc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 2,
    marginBottom: 12, overflow: 'hidden',
  },
  cardTop:    { flexDirection: 'row', padding: 14, paddingBottom: 10 },
  cardRight:  { alignItems: 'flex-end', justifyContent: 'space-between' },
  cardName:   { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  cardVariant:{ fontSize: 13, color: '#6b7280', marginBottom: 2 },
  cardSku:    { fontSize: 11, color: '#9ca3af' },
  cardOrder:  { fontSize: 11, color: '#ef4444', fontWeight: '600', marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '800' },
  oosPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 6, alignSelf: 'flex-start' },
  oosPillText:{ fontSize: 10, fontWeight: '800', color: '#ef4444', letterSpacing: 0.4 },
  cardBottom: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  statBox:    { flex: 1, alignItems: 'center', gap: 2 },
  statLabel:  { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  statValue:  { fontSize: 13, fontWeight: '800', color: '#374151' },
  statDivider:{ width: 1, backgroundColor: '#f3f4f6' },
});

const sess = StyleSheet.create({
  header: {
    backgroundColor: '#FF6B35',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  skuPill: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  skuText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  body: { padding: 16, paddingBottom: 120 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb',
  },
  statCardLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  statCardValue: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  statCardUnit:  { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  scanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff7ed', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 16,
  },
  scanBadgeText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  qtySection: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
  qtySectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  qtySectionHint:  { fontSize: 12, color: '#9ca3af', marginBottom: 14 },
  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyInput:  { flex: 1, fontSize: 36, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  scanBtn:   { backgroundColor: '#FF6B35', borderRadius: 14, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, elevation: 2 },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  noBarcode: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde68a' },
  noBarcodeText: { flex: 1, fontSize: 12, color: '#92400e' },
  notesSection: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 4 },
  notesInput: { backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, fontSize: 14, color: '#1a1a1a', minHeight: 80, marginTop: 8 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  submitBtn: { backgroundColor: '#10b981', borderRadius: 14, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 3 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// FIXED: renamed from 'oos' to 'oosStyles' to avoid conflict with state variable name
const oosStyles = StyleSheet.create({
  contextCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    borderWidth: 2, borderColor: '#fca5a5', marginBottom: 16,
    alignItems: 'center', gap: 8,
  },
  contextTitle: { fontSize: 17, fontWeight: '800', color: '#ef4444', textAlign: 'center' },
  contextDesc:  { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  contextSku:   { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  contextSkuLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', width: 90, textAlign: 'right' },
  contextSkuValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, elevation: 2 },
  actionBtnRed:   { backgroundColor: '#ef4444' },
  actionBtnGreen: { backgroundColor: '#10b981' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  footerNote: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18, paddingHorizontal: 8, marginBottom: 100 },
});