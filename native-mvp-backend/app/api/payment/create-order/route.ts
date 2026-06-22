// screens/CheckoutScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { createSafePayOrder } from '../services/safepay';

interface CheckoutScreenProps {
  amount: number;
  description: string;
}

const CheckoutScreen = ({ amount, description }: CheckoutScreenProps) => {
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);

  const handlePayNow = async () => {
    if (!customerEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);

    const result = await createSafePayOrder({
      amount,
      description,
      customerEmail: customerEmail.trim(),
      customerName: customerName.trim(),
    });

    setLoading(false);

    if (result.success && result.checkoutUrl) {
      setCheckoutUrl(result.checkoutUrl);
      setShowWebView(true);
    } else {
      Alert.alert('Payment Error', result.error || 'Could not create order');
    }
  };

  const handleWebViewNavigationChange = (navState: { url: string }) => {
    // Detect success/failure redirect URLs from SafePay
    if (navState.url.includes('/payment/success')) {
      setShowWebView(false);
      Alert.alert('Payment Successful', 'Your payment was completed!');
    } else if (navState.url.includes('/payment/cancel')) {
      setShowWebView(false);
      Alert.alert('Payment Cancelled', 'Your payment was cancelled.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Order Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Order Summary</Text>
        <Text style={styles.summaryDescription}>{description}</Text>
        <Text style={styles.summaryAmount}>PKR {amount.toLocaleString()}</Text>
      </View>

      {/* Customer Details Form */}
      <View style={styles.form}>
        <Text style={styles.formLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={customerName}
          onChangeText={setCustomerName}
          autoCapitalize="words"
        />

        <Text style={styles.formLabel}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Pay Button */}
      <TouchableOpacity
        style={[styles.payButton, loading && styles.payButtonDisabled]}
        onPress={handlePayNow}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payButtonText}>Pay PKR {amount.toLocaleString()}</Text>
        )}
      </TouchableOpacity>

      {/* SafePay Checkout WebView Modal */}
      <Modal visible={showWebView} animationType="slide">
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>Secure Checkout</Text>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Text style={styles.closeButton}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          {checkoutUrl && (
            <WebView
              source={{ uri: checkoutUrl }}
              onNavigationStateChange={handleWebViewNavigationChange}
              startInLoadingState
              renderLoading={() => (
                <ActivityIndicator style={styles.webViewLoader} size="large" color="#4F46E5" />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4F46E5',
  },
  form: {
    marginBottom: 32,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
  payButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  webViewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  webViewLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});

export default CheckoutScreen;