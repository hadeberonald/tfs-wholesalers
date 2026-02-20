import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import {
  Shield,
  XCircle,
  ChevronLeft,
  Lock,
  Package,
  RefreshCw,
  Zap,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
type PaymentStatus = 'idle' | 'initializing' | 'webview' | 'verifying' | 'failed' | 'refunding';

interface OrderSummaryItem {
  name: string;
  quantity: number;
  price: number;
  variantName?: string;
  inStock: boolean;
}

// ─── Paystack WebView HTML ────────────────────────────────────────────────────
function buildPaystackHTML(publicKey: string, email: string, amountKobo: number, reference: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://js.paystack.co/v1/inline.js"></script>
</head>
<body style="background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div id="loading" style="text-align:center;font-family:sans-serif;">
    <div style="font-size:18px;color:#1f2937;margin-bottom:8px;">Opening secure payment…</div>
    <div style="color:#6b7280;font-size:14px;">Please wait</div>
  </div>
  <script>
    window.onload = function() {
      var handler = PaystackPop.setup({
        key: '${publicKey}',
        email: '${email}',
        amount: ${amountKobo},
        currency: 'ZAR',
        ref: '${reference}',
        onClose: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'closed' }));
        },
        callback: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'success', reference: response.reference }));
        }
      });
      handler.openIframe();
    };
  </script>
</body>
</html>
`;
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    idle:        { color: '#6b7280', bg: '#f3f4f6', label: 'Ready' },
    initializing:{ color: '#f59e0b', bg: '#fef3c7', label: 'Preparing…' },
    webview:     { color: '#3b82f6', bg: '#dbeafe', label: 'In Progress' },
    verifying:   { color: '#8b5cf6', bg: '#ede9fe', label: 'Verifying…' },
    failed:      { color: '#ef4444', bg: '#fee2e2', label: 'Failed' },
    refunding:   { color: '#f59e0b', bg: '#fef3c7', label: 'Refunding…' },
  };
  const s = map[status] || map.idle;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: s.color }]} />
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string; amount: string; orderNumber: string }>();

  const user = useStore((s) => s.user);
  const clearCart = useStore((s) => s.clearCart);

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [paystackHtml, setPaystackHtml] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [orderItems, setOrderItems] = useState<OrderSummaryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));

  const orderId = params?.orderId || '';
  const amount = parseFloat(params?.amount || '0');
  const orderNumber = params?.orderNumber || '';

  // ── pulse animation for "pay" button ────────────────────────────────────
  useEffect(() => {
    if (status === 'idle') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status]);

  // ── load order items ─────────────────────────────────────────────────────
  useEffect(() => {
    if (orderId) loadOrderItems();
  }, [orderId]);

  const loadOrderItems = async () => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      const items: OrderSummaryItem[] = (res.data.order?.items || []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        variantName: i.variantName,
        inStock: true,
      }));
      setOrderItems(items);
    } catch {}
  };

  // ── initialise payment ───────────────────────────────────────────────────
  const initPayment = async () => {
    if (!user?.email) {
      Alert.alert('Sign In Required', 'Please sign in to complete your payment.');
      return;
    }
    setStatus('initializing');
    try {
      const res = await api.post('/api/payment/initialize', {
        orderId,
        email: user.email,
        amount,
      });

      if (res.data.success) {
        setReference(res.data.reference);

        if (res.data.charged) {
          // Saved card charged directly — skip webview
          await handleVerify(res.data.reference);
          return;
        }

        const html = buildPaystackHTML(
          res.data.publicKey,
          user.email,
          Math.round(amount * 100),
          res.data.reference
        );
        setPaystackHtml(html);
        setStatus('webview');
      } else {
        throw new Error(res.data.error || 'Initialization failed');
      }
    } catch (e: any) {
      setStatus('failed');
      setErrorMessage(e?.message || 'Could not start payment. Please try again.');
    }
  };

  // ── WebView message handler ──────────────────────────────────────────────
  const onWebViewMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.event === 'closed') {
        setStatus('idle');
        setPaystackHtml(null);
      } else if (msg.event === 'success') {
        setPaystackHtml(null);
        setStatus('verifying');
        await handleVerify(msg.reference);
      }
    } catch {}
  };

  // ── verify payment + check stock + refund if needed ──────────────────────
  const handleVerify = async (ref: string) => {
    setStatus('verifying');
    try {
      const res = await api.post('/api/payment/verify', { reference: ref });
      if (!res.data.verified) throw new Error(res.data.error || 'Verification failed');

      const stockChecks = await checkStock();
      const outOfStock = stockChecks.filter((i) => !i.inStock);

      if (outOfStock.length > 0) {
        const refundTotal = outOfStock.reduce((s, i) => s + i.price * i.quantity, 0);
        setStatus('refunding');
        await processRefund(ref, refundTotal, outOfStock);
      } else {
        // ✅ Payment verified — navigate directly to order tracking
        clearCart();
        router.replace(`/order-preparing?orderId=${orderId}`);
      }
    } catch (e: any) {
      setStatus('failed');
      setErrorMessage(e?.message || 'Payment could not be verified.');
    }
  };

  // ── stock check ──────────────────────────────────────────────────────────
  const checkStock = async (): Promise<OrderSummaryItem[]> => {
    const result: OrderSummaryItem[] = [];
    for (const item of orderItems) {
      try {
        const res = await api.get(`/api/products/check-stock`, {
          params: { name: item.name },
        });
        result.push({ ...item, inStock: res.data.inStock !== false });
      } catch {
        result.push({ ...item, inStock: true });
      }
    }
    return result;
  };

  // ── auto-refund out-of-stock items ───────────────────────────────────────
  const processRefund = async (ref: string, refundAmt: number, items: OrderSummaryItem[]) => {
    try {
      await api.post('/api/payment/refund', {
        reference: ref,
        amount: refundAmt,
        reason: `Out of stock: ${items.map((i) => i.name).join(', ')}`,
        orderId,
      });
      await api.patch(`/api/orders/${orderId}`, {
        partialRefund: true,
        refundAmount: refundAmt,
        outOfStockItems: items.map((i) => i.name),
      });
      clearCart();
      // Navigate to order tracking — order-preparing will show current status
      router.replace(`/order-preparing?orderId=${orderId}`);
    } catch {
      clearCart();
      Alert.alert(
        'Refund Pending',
        `Your order was placed but a refund of R${refundAmt.toFixed(2)} for out-of-stock items could not be processed automatically. Our team will contact you.`,
        [{ text: 'OK', onPress: () => router.replace(`/order-preparing?orderId=${orderId}`) }]
      );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // WebView payment page
  if (status === 'webview' && paystackHtml) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            onPress={() => { setStatus('idle'); setPaystackHtml(null); }}
            style={styles.webViewBack}
          >
            <ChevronLeft color="#1f2937" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.webViewTitle}>Secure Payment</Text>
            <Text style={styles.webViewSub}>Powered by Paystack</Text>
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
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={{ color: '#6b7280', marginTop: 12 }}>Loading secure checkout…</Text>
            </View>
          )}
        />
      </View>
    );
  }

  // Failed screen — the ONLY non-webview result screen we keep
  if (status === 'failed') {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.failCircle}>
          <XCircle color="#ef4444" size={72} />
        </View>
        <Text style={styles.resultTitle}>Payment Failed</Text>
        <Text style={styles.resultSub}>{errorMessage || 'Something went wrong. Please try again.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => setStatus('idle')}>
          <RefreshCw color="#fff" size={20} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main payment page ─────────────────────────────────────────────────────
  const isProcessing = status === 'initializing' || status === 'verifying' || status === 'refunding';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <StatusBadge status={status} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Order summary card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package color="#FF6B35" size={20} />
            <Text style={styles.cardTitle}>Order {orderNumber}</Text>
          </View>
          {orderItems.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.name}{item.variantName ? ` — ${item.variantName}` : ''}
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

        {/* Security info */}
        <View style={styles.securityRow}>
          <Shield color="#10b981" size={16} />
          <Text style={styles.securityText}>
            Payments are processed securely by Paystack. Your card details are never stored.
          </Text>
        </View>

        {/* Trust badges */}
        <View style={styles.trustRow}>
          {['256-bit SSL', 'PCI-DSS', 'ZAR Secured'].map((label) => (
            <View key={label} style={styles.trustBadge}>
              <Lock color="#6b7280" size={12} />
              <Text style={styles.trustLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Processing status */}
        {isProcessing && (
          <View style={styles.processingCard}>
            <ActivityIndicator color="#FF6B35" size="large" />
            <Text style={styles.processingTitle}>
              {status === 'initializing' ? 'Preparing Payment…' :
               status === 'verifying'    ? 'Verifying Payment…' :
               'Processing Refund…'}
            </Text>
            <Text style={styles.processingText}>
              {status === 'refunding'
                ? "Some items were out of stock. We're issuing an automatic refund."
                : 'Please do not close this screen.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pay button */}
      {!isProcessing && (
        <View style={styles.footer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.payBtn} onPress={initPayment}>
              <Zap color="#fff" size={22} fill="#fff" />
              <Text style={styles.payBtnText}>Pay R{amount.toFixed(2)}</Text>
              <Lock color="rgba(255,255,255,0.7)" size={16} />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.footerNote}>You will be redirected to Paystack's secure gateway</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1f2937' },

  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 120 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemQty: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#FF6B35' },

  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 12,
  },
  securityText: { flex: 1, fontSize: 12, color: '#15803d', lineHeight: 18 },

  trustRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  trustBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  trustLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },

  processingCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  processingTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  processingText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  payBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 18,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#FF6B35',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  payBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  footerNote: { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 10 },

  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  webViewBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  webViewTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  webViewSub: { fontSize: 12, color: '#9ca3af' },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  lockText: { fontSize: 11, color: '#065f46', fontWeight: '700' },
  webViewLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },

  resultContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  failCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: { fontSize: 26, fontWeight: '800', color: '#1f2937', marginBottom: 8, textAlign: 'center' },
  resultSub: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  retryBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    width: '100%',
    justifyContent: 'center',
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});