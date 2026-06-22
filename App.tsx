import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl ?? 'http://192.168.18.2:3000';
const SAFE_PAY_BASE_URL = Constants.expoConfig?.extra?.safePayBaseUrl ?? 'https://sandbox.api.getsafepay.com';

export default function App() {
  const [amount, setAmount] = useState('100');
  const [description, setDescription] = useState('Mobile App Purchase');
  const [customerEmail, setCustomerEmail] = useState('customer@example.com');
  const [customerName, setCustomerName] = useState('Test Customer');
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);

  const handlePayment = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!customerEmail) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!customerName) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    setPaymentStatus(null);
    setOrderData(null);

    try {
      // Call your backend API to create a SafePay order
      const response = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(amount),
          description,
          customerEmail,
          customerName,
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        setOrderData(data);
        setPaymentStatus(`✅ Order Created!\nOrder ID: ${data.orderId}\nAmount: ₨${amount}`);
        
        // Open SafePay checkout
        setTimeout(() => {
          openCheckout(data.checkoutUrl);
        }, 500);
      } else {
        setPaymentStatus(`❌ Error: ${data.error}`);
        Alert.alert('Error', data.error || 'Payment failed');
      }
    } catch (error) {
      setPaymentStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Error', 'Failed to process payment');
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = async (checkoutUrl: string) => {
    try {
      // Open SafePay checkout in browser
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      
      if (result.type === 'opened') {
        setPaymentStatus('✅ Checkout opened successfully!');
        // Check payment status after browser closes
        setTimeout(() => {
          checkPaymentStatus();
        }, 2000);
      } else if (result.type === 'cancel') {
        setPaymentStatus('⚠️ Checkout cancelled by user');
      } else if (result.type === 'dismissed' || result.type === 'dismiss') {
        setPaymentStatus('⚠️ Checkout closed');
      } else {
        setPaymentStatus('⚠️ Checkout result: ' + result.type);
      }
    } catch (error) {
      console.error('Failed to open checkout:', error);
      // Fallback to system browser
      try {
        await Linking.openURL(checkoutUrl);
        setPaymentStatus('✅ Checkout opened in system browser');
      } catch (err) {
        Alert.alert('Error', 'Could not open checkout page');
      }
    }
  };

  const checkPaymentStatus = async () => {
    if (!orderData?.orderId) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/payment/order-status/${orderData.orderId}`
      );
      const data = await response.json();

      if (data.success) {
        if (data.status === 'paid') {
          setPaymentStatus(
            `✅ Payment Successful!\nOrder: ${data.orderId}\nAmount: ₨${amount}`
          );
          Alert.alert('Success', `Payment completed!\nOrder ID: ${data.orderId}`);
        } else if (data.status === 'pending') {
          setPaymentStatus('⏳ Payment pending...');
        } else if (data.status === 'failed') {
          setPaymentStatus('❌ Payment failed');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const resetForm = () => {
    setAmount('100');
    setDescription('Mobile App Purchase');
    setCustomerEmail('customer@example.com');
    setCustomerName('Test Customer');
    setPaymentStatus(null);
    setOrderData(null);
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💳 SafePay</Text>
        <Text style={styles.headerSubtitle}>Secure Payment Gateway</Text>
      </View>

      {/* Payment Form */}
      <View style={styles.formContainer}>
        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            value={customerName}
            onChangeText={setCustomerName}
            editable={!loading}
          />
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="customer@example.com"
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            editable={!loading}
          />
        </View>

        {/* Amount */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount (PKR)</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₨</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Order details"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </View>

        {/* Payment Status */}
        {paymentStatus && (
          <View style={[
            styles.statusBox,
            paymentStatus.includes('✅') && styles.successBox,
            paymentStatus.includes('❌') && styles.errorBox,
            paymentStatus.includes('⏳') && styles.pendingBox,
          ]}>
            <Text style={styles.statusText}>{paymentStatus}</Text>
          </View>
        )}

        {/* Order Summary */}
        {orderData && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>📋 Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order ID:</Text>
              <Text style={styles.summaryValue}>{orderData.orderId}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={styles.summaryValue}>₨{amount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Status:</Text>
              <Text style={styles.summaryValue}>Pending</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.payButton, loading && styles.buttonDisabled]}
            onPress={handlePayment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>💳 Process Payment</Text>
            )}
          </TouchableOpacity>

          {orderData && (
            <TouchableOpacity
              style={[styles.button, styles.checkButton]}
              onPress={checkPaymentStatus}
              disabled={loading}
            >
              <Text style={styles.buttonText}>🔄 Check Status</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetForm}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>ℹ️ About SafePay</Text>
        <Text style={styles.infoText}>• Secure payment processing</Text>
        <Text style={styles.infoText}>• Use test card details in sandbox</Text>
        <Text style={styles.infoText}>• Check payment status after checkout</Text>
        <Text style={styles.infoText}>• Backend: http://192.168.18.2:3000</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingLeft: 12,
    backgroundColor: '#f9fafb',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366f1',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  statusBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 14,
    borderRadius: 6,
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#dcfce7',
    borderLeftColor: '#16a34a',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderLeftColor: '#dc2626',
  },
  pendingBox: {
    backgroundColor: '#fef3c7',
    borderLeftColor: '#f59e0b',
  },
  statusText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  summaryBox: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    padding: 14,
    borderRadius: 6,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#1e40af',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: '#6366f1',
  },
  checkButton: {
    backgroundColor: '#3b82f6',
  },
  resetButton: {
    backgroundColor: '#9ca3af',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#eff6ff',
    margin: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 4,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingLeft: 12,
    backgroundColor: '#f9fafb',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366f1',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  statusBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '500',
  },
  urlBox: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  urlLabel: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  urlText: {
    color: '#92400e',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  linkButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: '#6366f1',
  },
  resetButton: {
    backgroundColor: '#9ca3af',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#eff6ff',
    margin: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 4,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingLeft: 12,
    backgroundColor: '#f9fafb',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366f1',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  statusBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: '#6366f1',
  },
  resetButton: {
    backgroundColor: '#9ca3af',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#eff6ff',
    margin: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 4,
    lineHeight: 20,
  },
});
