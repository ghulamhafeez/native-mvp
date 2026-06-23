import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { addTransaction } from '../store/transactions';
import { createInvoiceForTransaction } from '../api/invoices';
import { SAFEPAY_CLIENT_KEY, SAFEPAY_SANDBOX_URL } from '../api/safepayConfig';

// ─── SafePay Config ───────────────────────────────────────────────────────────
// ─── Helpers ─────────────────────────────────────────────────────────────────
async function createSafepayTracker(
  clientKey: string,
  amountPKR: number,
  currency: string
): Promise<string> {
  console.log('[Safepay] Creating tracker — amount (PKR):', amountPKR);
  const res = await fetch(`${SAFEPAY_SANDBOX_URL}/order/v1/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client:      clientKey,
      amount:      amountPKR,
      currency,
      environment: 'sandbox',
    }),
  });
  const json = await res.json();
  console.log('[Safepay] Tracker response:', JSON.stringify(json));
  if (!json?.data?.token) {
    throw new Error(json?.status?.errors?.join(', ') || 'Failed to create tracker');
  }
  return json.data.token as string;
}

function buildCheckoutUrl(token: string, orderId: string): string {
  const params = new URLSearchParams({
    beacon:   token,
    order_id: orderId,
    source:   'mobile',
    webhooks: 'false',
    env:      'sandbox',
  });
  const url = `${SAFEPAY_SANDBOX_URL}/checkout/pay?${params.toString()}`;
  console.log('[Safepay] Checkout URL:', url);
  return url;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
type Props = {
  onBack?: () => void;
  onInvoiceGenerated?: (invoiceId: string) => void;
};

export default function AmountScreen({ onBack, onInvoiceGenerated }: Props) {
  const [amount, setAmount]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const handledRef    = useRef(false);
  const orderIdRef    = useRef(`order_${Date.now()}`);
  // Keep the tracker token so we can pass it to refund API
  const trackerToken  = useRef<string>('');
  // Capture amount in a ref so handleRedirect always reads the current value
  // (avoids stale closure — amountInPKR is a derived value that resets on re-render)
  const amountRef     = useRef<number>(0);

  const parsedAmount  = parseFloat(amount.replace(/,/g, ''));
  const isValid       = !isNaN(parsedAmount) && parsedAmount > 0;
  const amountInPKR = isValid ? parsedAmount : 0;

  // Deep-link listener (Android back-button after payment)
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!showWebView || handledRef.current) return;
      handleRedirect(url);
    });
    return () => sub.remove();
  }, [showWebView]);

  // ── SafePay redirect URL patterns (from official docs) ──
  const handleRedirect = async (url: string) => {
    if (handledRef.current) return;
    const isSuccess = url.includes('action=complete')  ||
                      url.includes('/external/complete');
    const isCancel  = url.includes('action=cancelled') ||
                      url.includes('/external/error');

    if (isSuccess) {
      handledRef.current = true;
      setShowWebView(false);

      // Record in transaction store so it shows up in history with refund support
      const transaction = await addTransaction({
        paymentToken: trackerToken.current,
        type:         'payment',
        description:  'One-Time Payment',
        amount:       amountRef.current,  // use ref — never stale
        currency:     'PKR',
        status:       'succeeded',
      });

      let invoiceId: string | undefined;
      try {
        const invoice = await createInvoiceForTransaction(transaction);
        invoiceId = invoice.id;
      } catch (err) {
        console.warn('[Invoice] generation failed:', err);
      }

      Alert.alert(
        'Payment Successful 🎉',
        invoiceId
          ? 'Your payment is complete!'
          : 'Your payment is complete, but the invoice PDF could not be prepared.',
        [
          ...(invoiceId
            ? [{
              text: 'View Invoice',
              onPress: () => {
                handledRef.current = false;
                setAmount('');
                onInvoiceGenerated?.(invoiceId);
              },
            }]
            : []),
          { text: 'OK', onPress: () => { handledRef.current = false; setAmount(''); } },
        ],
      );
    } else if (isCancel) {
      handledRef.current = true;
      setShowWebView(false);
      Alert.alert('Cancelled', 'Payment cancel kar di gayi.', [
        { text: 'OK', onPress: () => { handledRef.current = false; } },
      ]);
    }
  };

  const handleWebViewNav = (navState: WebViewNavigation) => {
    console.log('[WebView] url:', navState.url);
    handleRedirect(navState.url);
  };

  // ── Pay button pressed ──
  const handlePay = async () => {
    if (!isValid) return;
    setLoading(true);
    handledRef.current   = false;
    orderIdRef.current   = `order_${Date.now()}`;
    amountRef.current    = amountInPKR; // snapshot before any async/re-render

    try {
      const token      = await createSafepayTracker(SAFEPAY_CLIENT_KEY, amountInPKR, 'PKR');
      trackerToken.current = token;
      const url        = buildCheckoutUrl(token, orderIdRef.current);
      setCheckoutUrl(url);
      setShowWebView(true);
    } catch (err: any) {
      console.error('[Safepay] Error:', err.message);
      Alert.alert('Error', err.message || 'SafePay se connect nahi ho saka.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowWebView(false);
    handledRef.current = false;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.backBtnText}>‹ Back</Text>
            </TouchableOpacity>
          )}

          {/* Brand */}
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>SafePay</Text>
            <View style={styles.sandboxBadge}>
              <Text style={styles.sandboxText}>SANDBOX</Text>
            </View>
          </View>

          {/* Amount card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Enter Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyLabel}>PKR</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handlePay}
                autoFocus
              />
            </View>
            {isValid && (
              <Text style={styles.amountHint}>
                PKR {parsedAmount.toLocaleString('en-PK')}
              </Text>
            )}
          </View>

          {/* Pay button */}
          <TouchableOpacity
            style={[styles.payBtn, (!isValid || loading) && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.payBtnText}>  Connecting to SafePay...</Text>
              </View>
            ) : (
              <Text style={styles.payBtnText}>
                {isValid
                  ? `Pay PKR ${parsedAmount.toLocaleString('en-PK')}`
                  : 'Enter Amount to Pay'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.secureNote}>🔒  Secured by SafePay · 256-bit SSL</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── SafePay Mobile Checkout WebView ── */}
      <Modal
        visible={showWebView}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleClose}
        onShow={() => console.log('[Modal] opened — url:', checkoutUrl)}
      >
        <SafeAreaView style={styles.wvSafe}>

          {/* Header bar */}
          <View style={styles.wvBar}>
            <View style={styles.wvBarLeft}>
              <Text style={styles.wvLock}>🔒</Text>
              <Text style={styles.wvBarTitle}>SafePay Checkout</Text>
            </View>
            <TouchableOpacity
              style={styles.wvCloseBtn}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.wvCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {checkoutUrl ? (
            <WebView
              source={{ uri: checkoutUrl }}
              onNavigationStateChange={handleWebViewNav}
              onError={(e) => console.error('[WebView] error:', e.nativeEvent)}
              onHttpError={(e) => console.error('[WebView] http error:', e.nativeEvent.statusCode, e.nativeEvent.url)}
              onLoadStart={(e) => console.log('[WebView] loadStart:', e.nativeEvent.url)}
              onLoadEnd={(e)   => console.log('[WebView] loadEnd:',   e.nativeEvent.url)}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['https://*', 'http://*']}
              renderLoading={() => (
                <View style={styles.wvLoader}>
                  <ActivityIndicator size="large" color="#111827" />
                  <Text style={styles.wvLoaderTxt}>Loading SafePay...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.wvLoader}>
              <Text style={{ color: 'red' }}>❌ No checkout URL</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#fff' },
  flex:  { flex: 1 },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    justifyContent: 'center',
  },

  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 10,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sandboxBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sandboxText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 20,
    textAlign: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyLabel: {
    fontSize: 26,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 8,
    marginTop: 6,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: '800',
    color: '#111827',
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  amountHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
  },

  payBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  payBtnDisabled: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  secureNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // WebView modal
  wvSafe: { flex: 1, backgroundColor: '#fff' },
  wvBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  wvBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wvLock:     { fontSize: 15 },
  wvBarTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  wvCloseBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wvCloseTxt: { fontSize: 14, fontWeight: '700', color: '#374151' },
  wvLoader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  wvLoaderTxt: { marginTop: 12, fontSize: 14, color: '#6B7280' },
});
