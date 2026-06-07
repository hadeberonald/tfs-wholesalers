import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, BackHandler, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield, XCircle, ChevronLeft, Lock, Package, RefreshCw,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

type PaymentStatus = 'initializing' | 'webview' | 'verifying' | 'failed' | 'refunding';

interface OrderSummaryItem {
  name: string; quantity: number; price: number;
  variantName?: string; inStock: boolean;
}

function buildPaystackHTML(publicKey: string, email: string, amountKobo: number, reference: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <script src="https://js.paystack.co/v1/inline.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f9fafb;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; font-family: -apple-system, sans-serif;
    }
    .loading { text-align: center; padding: 32px; }
    .loading-title { font-size: 17px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
    .loading-sub   { font-size: 13px; color: #6b7280; }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #f3f4f6;
      border-top-color: #FF6B35; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <div class="loading-title">Opening secure payment\u2026</div>
    <div class="loading-sub">Please do not close this screen</div>
  </div>
  <script>
    window.onload = function() {
      try {
        var handler = PaystackPop.setup({
          key: '${publicKey}',
          email: '${email}',
          amount: ${amountKobo},
          currency: 'ZAR',
          ref: '${reference}',
          onClose: function() {
            // User manually dismissed Paystack popup (tapped X or back inside popup).
            // We notify RN so it can decide what to do — NOT auto-close the screen.
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'closed' }));
          },
          callback: function(response) {
            // Payment completed successfully — auto-proceed immediately.
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'success', reference: response.reference }));
          }
        });
        handler.openIframe();
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'error', message: e.message }));
      }
    };
  </script>
</body>
</html>
`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    initializing: { color: '#f59e0b', bg: '#fef3c7', label: 'Preparing\u2026' },
    webview:      { color: '#3b82f6', bg: '#dbeafe', label: 'In Progress' },
    verifying:    { color: '#8b5cf6', bg: '#ede9fe', label: 'Verifying\u2026' },
    failed:       { color: '#ef4444', bg: '#fee2e2', label: 'Failed' },
    refunding:    { color: '#f59e0b', bg: '#fef3c7', label: 'Refunding\u2026' },
  };
  const s = map[status] || map.initializing;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: s.color }]} />
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export default function PaymentScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ orderId: string; amount: string; orderNumber: string }>();

  const user      = useStore((s) => s.user);
  const clearCart = useStore((s) => s.clearCart);

  const [status, setStatus]             = useState<PaymentStatus>('initializing');
  const [paystackHtml, setPaystackHtml] = useState<string | null>(null);
  const [reference, setReference]       = useState('');
  const [orderItems, setOrderItems]     = useState<OrderSummaryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const hasInitialized                  = useRef(false);
  const verifyAbortRef                  = useRef<AbortController | null>(null);

  const orderId     = params?.orderId     || '';
  const amount      = parseFloat(params?.amount || '0');
  const orderNumber = params?.orderNumber || '';

  // ── Hardware back button interception ─────────────────────────────────────
  // Re-registers whenever `status` changes so it always has the current value.
  useEffect(() => {
    const onBackPress = () => {
      if (status === 'verifying' || status === 'refunding') {
        // Block back entirely — payment is in-flight, navigating away is dangerous
        Alert.alert(
          'Please Wait',
          'Your payment is being processed. Please do not go back.',
          [{ text: 'OK' }]
        );
        return true; // consumed — default back suppressed
      }

      if (status === 'webview') {
        // Treat hardware back same as popup close — attempt verify in case they paid.
        // onWebViewMessage 'closed' won't fire from a hardware back, so we handle it here.
        setPaystackHtml(null);
        setStatus('verifying');
        handleVerify(reference);
        return true;
      }

      // initializing / failed → allow default back
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (orderId) loadOrderItems();
    return () => { verifyAbortRef.current?.abort(); };
  }, [orderId]);

  useEffect(() => {
    if (!hasInitialized.current && orderId && user?.email) {
      hasInitialized.current = true;
      initPayment();
    }
  }, [orderId, user?.email]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const loadOrderItems = async () => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      const items: OrderSummaryItem[] = (res.data.order?.items || []).map((i: any) => ({
        name: i.name, quantity: i.quantity, price: i.price,
        variantName: i.variantName, inStock: true,
      }));
      setOrderItems(items);
    } catch {}
  };

  const initPayment = async () => {
    if (!user?.email) {
      Alert.alert('Sign In Required', 'Please sign in to complete your payment.');
      router.back();
      return;
    }
    setStatus('initializing');
    try {
      const res = await api.post('/api/payment/initialize', { orderId, email: user.email });
      if (!res.data.success) throw new Error(res.data.error || 'Initialization failed');

      setReference(res.data.reference);

      if (res.data.charged) {
        await handleVerify(res.data.reference);
        return;
      }

      const html = buildPaystackHTML(
        res.data.publicKey,
        user.email,
        res.data.amountKobo,
        res.data.reference,
      );
      setPaystackHtml(html);
      setStatus('webview');
    } catch (e: any) {
      setStatus('failed');
      setErrorMessage(e?.message || 'Could not start payment. Please try again.');
    }
  };

  const onWebViewMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.event === 'closed') {
        // Paystack popup closed — this fires whether the user cancelled OR
        // whether the payment completed but the callback didn't fire (network
        // race, popup auto-dismissed, etc.). We always attempt verification
        // using the reference we already have. If the payment went through,
        // verify succeeds and we proceed. If it genuinely wasn't paid, verify
        // returns unverified and we show the failed screen with a retry option.
        // This means the user never has to do anything after paying — it just works.
        setPaystackHtml(null);
        setStatus('verifying');
        await handleVerify(reference);

      } else if (msg.event === 'success') {
        // Payment completed — auto-close WebView and proceed to verify immediately.
        setPaystackHtml(null);
        setStatus('verifying');
        await handleVerify(msg.reference);

      } else if (msg.event === 'error') {
        setStatus('failed');
        setErrorMessage(msg.message || 'Payment encountered an error.');
        setPaystackHtml(null);
      }
    } catch {}
  };

  /**
   * THE FIX for cart rehydration after payment:
   *
   * The bug: clearCart() sets items:[] in Zustand memory instantly, but the
   * persist middleware writes to AsyncStorage asynchronously. router.replace()
   * fires before that write completes. When order-preparing mounts, Zustand
   * rehydrates from the stale AsyncStorage snapshot (still has the cart) and
   * restores all the items.
   *
   * Fix: we manually patch the persisted JSON in AsyncStorage to zero out
   * items BEFORE calling router.replace(). That way, even if rehydration runs,
   * it reads an already-empty cart. clearCart() is still called to keep
   * in-memory state consistent (updates the cart badge immediately).
   */
  const clearCartAndNavigate = async (destination: string) => {
    // Step 1: clear in-memory state so cart badge shows 0 immediately
    clearCart();

    // Step 2: directly patch the AsyncStorage snapshot so rehydration
    // on the next screen reads an empty cart, not the stale full one.
    try {
      const STORE_KEY = 'tfs-customer-store';
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state) {
          parsed.state.items = [];
          await AsyncStorage.setItem(STORE_KEY, JSON.stringify(parsed));
        }
      }
    } catch (e) {
      // Non-fatal — payment succeeded, don't block the user
      console.warn('[clearCartAndNavigate] AsyncStorage patch failed:', e);
    }

    // Step 3: navigate only after the write has completed
    router.replace(destination as any);
  };

  const handleVerify = async (ref: string) => {
    setStatus('verifying');

    verifyAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    verifyAbortRef.current = abortCtrl;

    const RETRY_DELAYS  = [3000, 4000, 5000, 6000, 8000, 8000, 8000, 10000];
    const MAX_ATTEMPTS  = RETRY_DELAYS.length + 1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (abortCtrl.signal.aborted) return;

      if (attempt > 0) {
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        console.log(`[Verify] Attempt ${attempt + 1}/${MAX_ATTEMPTS} — waiting ${delay}ms`);
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, delay);
          abortCtrl.signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
        }).catch(() => null);
        if (abortCtrl.signal.aborted) return;
      }

      try {
        console.log(`[Verify] Sending verify request attempt ${attempt + 1}`);
        const res = await api.post('/api/payment/verify', { reference: ref });

        if (res.status === 202 || res.data.pending || res.data.retryable) {
          console.log(`[Verify] Attempt ${attempt + 1}: transient — will retry`);
          continue;
        }

        if (!res.data.verified && res.data.retryable === false) {
          throw Object.assign(new Error(res.data.error || 'Verification failed'), { retryable: false });
        }

        if (res.data.verified) {
          if (abortCtrl.signal.aborted) return;

          // Patch order to 'pending' (paid) — triggers confirmation email on server
          try {
            await api.patch(`/api/orders/${orderId}`, {
              status:           'pending',
              paymentStatus:    'paid',
              paymentReference: ref,
            });
            console.log(`[Verify] Order ${orderId} patched to pending/paid`);
          } catch (patchErr: any) {
            console.error('[Verify] Failed to patch order status:', patchErr?.message);
          }

          const stockChecks = await checkStock();
          const outOfStock  = stockChecks.filter((i) => !i.inStock);

          if (outOfStock.length > 0) {
            const refundTotal = outOfStock.reduce((s, i) => s + i.price * i.quantity, 0);
            setStatus('refunding');
            await processRefund(ref, refundTotal, outOfStock);
          } else {
            await clearCartAndNavigate(`/order-preparing?orderId=${orderId}`);
          }
          return;
        }

        console.warn(`[Verify] Unexpected response shape on attempt ${attempt + 1}:`, res.data);
        if (attempt < MAX_ATTEMPTS - 1) continue;
        throw new Error(res.data.error || 'Unexpected verification response');

      } catch (e: any) {
        if (abortCtrl.signal.aborted) return;
        if (e.message === 'aborted') return;

        const serverData  = e?.response?.data;
        const httpStatus  = e?.response?.status;
        const isRetryable = serverData?.retryable === true ||
                            (httpStatus === 202)           ||
                            e?.retryable === true;

        if (isRetryable && attempt < MAX_ATTEMPTS - 1) {
          console.warn(`[Verify] Attempt ${attempt + 1} retryable error, continuing\u2026`);
          continue;
        }

        console.error(`[Verify] Terminal failure:`, e?.message);
        setStatus('failed');
        setErrorMessage(
          serverData?.error ||
          e?.message ||
          `Payment verification failed. If you were charged, contact support with reference: ${ref}`
        );
        return;
      }
    }

    if (abortCtrl.signal.aborted) return;
    setStatus('failed');
    setErrorMessage(
      `Verification timed out. If you were charged, contact support with reference: ${ref}`
    );
  };

  const checkStock = async (): Promise<OrderSummaryItem[]> => {
    const result: OrderSummaryItem[] = [];
    for (const item of orderItems) {
      try {
        const res = await api.get(`/api/products/check-stock`, { params: { name: item.name } });
        result.push({ ...item, inStock: res.data.inStock !== false });
      } catch { result.push({ ...item, inStock: true }); }
    }
    return result;
  };

  const processRefund = async (ref: string, refundAmt: number, items: OrderSummaryItem[]) => {
    try {
      await api.post('/api/payment/refund', {
        reference: ref, amount: refundAmt,
        reason: `Out of stock: ${items.map((i) => i.name).join(', ')}`, orderId,
      });
      await api.patch(`/api/orders/${orderId}`, {
        partialRefund: true, refundAmount: refundAmt,
        outOfStockItems: items.map((i) => i.name),
      });
    } catch (e) {
      console.error('[processRefund] Refund API failed:', e);
    }
    // Always navigate regardless of refund API success/failure
    await clearCartAndNavigate(`/order-preparing?orderId=${orderId}`);
  };

  // ── WebView ───────────────────────────────────────────────────────────────
  if (status === 'webview' && paystackHtml) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
        <View style={styles.webViewHeader}>
          {/* Header back chevron — goes back; if user already paid, closed event will have triggered verify */}
          <TouchableOpacity onPress={() => router.back()} style={styles.webViewBack}>
            <ChevronLeft color="#1f2937" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.webViewTitle}>Secure Payment</Text>
            <Text style={styles.webViewSub}>Powered by Paystack · Order {orderNumber}</Text>
          </View>
          <View style={styles.lockBadge}>
            <Lock color="#10b981" size={14} />
            <Text style={styles.lockText}>SSL</Text>
          </View>
        </View>

        <WebView
          source={{ html: paystackHtml }}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => {
            const url = req.url || '';
            if (
              url === 'about:blank' ||
              url.startsWith('data:') ||
              url.includes('paystack.co')
            ) return true;
            if (url.startsWith('http')) {
              console.warn('[WebView] Blocking external URL:', url);
              return false;
            }
            return true;
          }}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.webViewLoadingText}>Loading secure checkout\u2026</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <SafeAreaView style={styles.resultContainer} edges={['top']}>
        <View style={styles.failCircle}><XCircle color="#ef4444" size={72} /></View>
        <Text style={styles.resultTitle}>Payment Failed</Text>
        <Text style={styles.resultSub}>{errorMessage || 'Something went wrong. Please try again.'}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            verifyAbortRef.current?.abort();
            hasInitialized.current = false;
            setErrorMessage('');
            initPayment();
          }}
        >
          <RefreshCw color="#fff" size={20} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Initializing / Verifying / Refunding ──────────────────────────────────
  const processingLabel =
    status === 'initializing' ? 'Preparing your payment\u2026' :
    status === 'verifying'    ? 'Confirming your payment\u2026' :
    'Processing refund\u2026';

  const processingSubLabel =
    status === 'refunding'
      ? "Some items were out of stock. We're issuing an automatic refund."
      : status === 'verifying'
      ? 'Your payment is being confirmed. This only takes a moment.'
      : 'Please do not close this screen.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={status === 'verifying' || status === 'refunding'}
        >
          <ChevronLeft
            color={status === 'verifying' || status === 'refunding' ? '#d1d5db' : '#1f2937'}
            size={24}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <StatusBadge status={status} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package color="#FF6B35" size={20} />
            <Text style={styles.cardTitle}>Order {orderNumber}</Text>
          </View>
          {orderItems.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.name}{item.variantName ? ` \u2014 ${item.variantName}` : ''}
                </Text>
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>R{amount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Shield color="#10b981" size={16} />
          <Text style={styles.securityText}>
            Payments are processed securely by Paystack. Your card details are never stored.
          </Text>
        </View>
        <View style={styles.trustRow}>
          {['256-bit SSL', 'PCI-DSS', 'ZAR Secured'].map((label) => (
            <View key={label} style={styles.trustBadge}>
              <Lock color="#6b7280" size={12} />
              <Text style={styles.trustLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.processingCard}>
          <ActivityIndicator color="#FF6B35" size="large" />
          <Text style={styles.processingTitle}>{processingLabel}</Text>
          <Text style={styles.processingText}>{processingSubLabel}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 12, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1f2937' },
  badge:     { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
  badgeDot:  { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  itemName:  { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemQty:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  divider:   { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:  { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#FF6B35' },
  securityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12,
  },
  securityText: { flex: 1, fontSize: 12, color: '#15803d', lineHeight: 18 },
  trustRow:  { flexDirection: 'row', gap: 8, marginBottom: 20 },
  trustBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  trustLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  processingCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 32, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  processingTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  processingText:  { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  webViewBack:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  webViewTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  webViewSub:   { fontSize: 12, color: '#9ca3af' },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  lockText: { fontSize: 11, color: '#065f46', fontWeight: '700' },
  webViewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  webViewLoadingText: { color: '#6b7280', marginTop: 12, fontSize: 14 },
  resultContainer: {
    flex: 1, backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  failCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  resultTitle: { fontSize: 26, fontWeight: '800', color: '#1f2937', marginBottom: 8, textAlign: 'center' },
  resultSub:   { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
    width: '100%', justifyContent: 'center',
  },
  retryText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:  { paddingVertical: 14, width: '100%', alignItems: 'center' },
  cancelText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});