import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { addTransaction } from '../store/transactions';
import { createInvoiceForTransaction } from '../api/invoices';
import {
  SAFEPAY_MERCHANT_SECRET,
  SAFEPAY_SANDBOX_URL,
} from '../api/safepayConfig';

// ─── Safepay Sandbox Config ───────────────────────────────────────────────────
// ─── Your real Safepay Sandbox Plan IDs ──────────────────────────────────────
const PLANS: Plan[] = [
  {
    id:          'plan_e27917d9-1f13-485b-905c-f3303f976940',
    name:        'Basic',
    price:       'PKR 2000 / mo',
    description: 'Core features · Email support',
    highlight:   false,
  },
  {
    id:          'plan_c09a27d7-0955-4824-8e36-8c0a59972766',
    name:        'Standard',
    price:       'PKR 4000 / mo',
    description: 'Everything in Basic · Priority support',
    highlight:   true,
  },
  {
    id:          'plan_b04e1999-9a16-4026-ad6d-2d7d451ae4a8',
    name:        'Premium',
    price:       'PKR 6000 / mo',
    description: 'Unlimited everything · Dedicated support',
    highlight:   false,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = {
  id:          string;
  name:        string;
  price:       string;
  description: string;
  highlight:   boolean;
};

type SubscriptionResult = {
  subscriptionId?: string;
  invoiceId?:      string;
  planId:   string;
  planName: string;
  status:   'active' | 'cancelled';
};

type Props = {
  onSuccess?: (result: SubscriptionResult) => void;
  onCancel?:  () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Step 1: Get a short-lived auth token from Safepay using the merchant secret.
// This is done on-device so the token is fresh when the WebView opens.
async function fetchAuthToken(): Promise<string> {
  const res = await fetch(`${SAFEPAY_SANDBOX_URL}/client/passport/v1/token`, {
    method:  'POST',
    headers: {
      'Content-Type':          'application/json',
      'X-SFPY-MERCHANT-SECRET': SAFEPAY_MERCHANT_SECRET,
    },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  console.log('[Subscription] auth token response:', JSON.stringify(json));
  if (!json?.data) {
    throw new Error(json?.status?.errors?.join(', ') || 'Failed to get auth token');
  }
  return json.data as string;
}

// Step 2: Build the subscription checkout URL using the fresh auth token.
function buildSubscriptionCheckoutUrl(
  planId:      string,
  authToken:   string,
  redirectUrl: string,
  cancelUrl:   string,
  reference?:  string,
): string {
  const params = new URLSearchParams({
    plan_id:      planId,
    auth_token:   authToken,
    env:          'sandbox',
    redirect_url: redirectUrl,
    cancel_url:   cancelUrl,
  });
  if (reference) params.append('reference', reference);
  const url = `${SAFEPAY_SANDBOX_URL}/checkout/subscribe?${params.toString()}`;
  console.log('[Subscription] checkout URL:', url);
  return url;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function SubscriptionScreen({ onSuccess, onCancel }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading]           = useState(false);
  const [checkoutUrl, setCheckoutUrl]   = useState<string | null>(null);
  const [showWebView, setShowWebView]   = useState(false);
  const handledRef                      = useRef(false);
  // Auth token ref so we can use it as a payment token for refunds
  const authTokenRef                    = useRef<string>('');

  // ── Build checkout URL directly on device (token stays fresh) ─────────────
  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    handledRef.current = false;

    try {
      const authToken = await fetchAuthToken();
      authTokenRef.current = authToken;

      const url = buildSubscriptionCheckoutUrl(
        selectedPlan.id,
        authToken,
        // Safepay will redirect to these after checkout.
        // We detect them in the WebView navigation handler below.
        `${SAFEPAY_SANDBOX_URL}/checkout/subscribe?status=success`,
        `${SAFEPAY_SANDBOX_URL}/checkout/subscribe?status=cancelled`,
        `ref_${Date.now()}`,
      );

      setCheckoutUrl(url);
      setShowWebView(true);
    } catch (err: any) {
      console.error('[Subscription] error:', err.message);
      Alert.alert('Error', err.message || 'Could not connect to SafePay.');
    } finally {
      setLoading(false);
    }
  };

  // ── Detect redirect URLs from Safepay ─────────────────────────────────────
  const handleRedirect = async (url: string) => {
    if (handledRef.current) return;

    // Safepay redirects to the redirect_url / cancel_url we passed above.
    // Detect by the status query param we added.
    const isSuccess   = url.includes('status=success');
    const isCancelled = url.includes('status=cancelled')
                     || url.includes('action=cancelled')
                     || url.includes('/external/error');

    if (isSuccess) {
      handledRef.current = true;
      setShowWebView(false);

      const result: SubscriptionResult = {
        planId:   selectedPlan!.id,
        planName: selectedPlan!.name,
        status:   'active',
      };

      // Record in transaction store so it shows up in history with refund support
      const planPrices: Record<string, number> = {
        'plan_e27917d9-1f13-485b-905c-f3303f976940': 2000,
        'plan_c09a27d7-0955-4824-8e36-8c0a59972766': 4000,
        'plan_b04e1999-9a16-4026-ad6d-2d7d451ae4a8': 6000,
      };
      const transaction = await addTransaction({
        paymentToken: authTokenRef.current,
        type:         'subscription',
        description:  `${selectedPlan!.name} Plan`,
        amount:       planPrices[selectedPlan!.id] ?? 0,
        currency:     'PKR',
        status:       'succeeded',
      });
      try {
        const invoice = await createInvoiceForTransaction(transaction);
        result.invoiceId = invoice.id;
      } catch (err) {
        console.warn('[Invoice] generation failed:', err);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        Alert.alert(
          'Subscription Activated! 🎉',
          `You are now on the ${selectedPlan!.name} plan.`,
          [{ text: 'OK', onPress: () => { handledRef.current = false; } }],
        );
      }
    } else if (isCancelled) {
      handledRef.current = true;
      setShowWebView(false);
      Alert.alert('Cancelled', 'Subscription checkout was cancelled.', [
        { text: 'OK', onPress: () => { handledRef.current = false; } },
      ]);
      onCancel?.();
    }
  };

  const handleWebViewNav = (navState: WebViewNavigation) => {
    console.log('[Subscription WebView] url:', navState.url);
    handleRedirect(navState.url);
  };

  const handleClose = () => {
    setShowWebView(false);
    handledRef.current = false;
    onCancel?.();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        {onCancel && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <Text style={styles.title}>Choose a Plan</Text>
       
        {/* Plan cards */}
        {PLANS.map((plan) => {
          const selected = selectedPlan?.id === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                plan.highlight && styles.planCardHighlight,
                selected      && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan(plan)}
              activeOpacity={0.8}
            >
              {plan.highlight && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View style={styles.radioOuter}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, selected && styles.planNameSelected]}>
                    {plan.name}
                  </Text>
                  <Text style={styles.planDesc}>{plan.description}</Text>
                </View>
                <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>
                  {plan.price}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Subscribe button */}
        <TouchableOpacity
          style={[styles.subBtn, (!selectedPlan || loading) && styles.subBtnDisabled]}
          onPress={handleSubscribe}
          disabled={!selectedPlan || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.subBtnText}>  Connecting to SafePay...</Text>
            </View>
          ) : (
            <Text style={styles.subBtnText}>
              {selectedPlan ? `Subscribe to ${selectedPlan.name}` : 'Select a Plan'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.secureNote}>🔒  Secured by SafePay · Cancel anytime</Text>
      </ScrollView>

      {/* ── Subscription Checkout WebView ── */}
      <Modal
        visible={showWebView}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.wvSafe}>
          {/* Header bar */}
          <View style={styles.wvBar}>
            <View style={styles.wvBarLeft}>
              <Text style={styles.wvLock}>🔒</Text>
              <Text style={styles.wvBarTitle}>SafePay Subscription</Text>
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
              onError={(e)     => console.error('[Sub WebView] error:', e.nativeEvent)}
              onHttpError={(e) => console.error('[Sub WebView] http error:', e.nativeEvent.statusCode)}
              onLoadStart={(e) => console.log('[Sub WebView] loadStart:', e.nativeEvent.url)}
              onLoadEnd={(e)   => console.log('[Sub WebView] loadEnd:',   e.nativeEvent.url)}
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
  safe: { flex: 1, backgroundColor: '#fff' },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
  },

  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },

  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 18,
    marginBottom: 14,
  },
  planCardHighlight: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  planCardSelected: {
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  planInfo: { flex: 1 },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  planNameSelected: { color: '#111827' },
  planDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'right',
  },
  planPriceSelected: { color: '#111827' },

  subBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  subBtnDisabled: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  subBtnText: {
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
