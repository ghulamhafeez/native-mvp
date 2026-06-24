import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Safepay configuration endpoints
const SAFEPAY_API_SECRET = 'ae022d549fb902451e2a2c174113df7708dc90b77ce485ddc7848b37bdeee8f5';
const SAFEPAY_BASE_URL = 'https://sandbox.api.safepaypayments.com'; // Payments and refunds domain

export default function TransactionHistoryScreen() {
  const [trackerId, setTrackerId] = useState('');
  const [amount, setAmount] = useState(''); // Amount field wapas add kiya
  const [reason, setReason] = useState('Customer Request');
  
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [responseData, setResponseData] = useState<any>(null);

  const handleDirectRefundSubmit = async () => {
    // Basic validation
    if (!trackerId || !amount) {
      setErrorMessage('Please fill in both Tracker ID and Amount.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    // Safepay rule: Convert Rupees decimal to Paisa integer (e.g. 150.50 -> 15050)
    const amountInPaisa = Math.round(Number(amount) * 100);
    
    const payload = {
      tracker: trackerId.trim(),
      amount: amountInPaisa,
      currency: 'PKR',
      reason: reason
    };

    console.log(`[Refund] Initiating direct API fetch for Tracker: ${trackerId.trim()} with Amount: ${amountInPaisa} Paisa`);

    try {
      // 💡 Direct Safepay Refund API Fetch
      const response = await fetch(`${SAFEPAY_BASE_URL}/v1/disbursements/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SFPY-MERCHANT-SECRET': SAFEPAY_API_SECRET
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`[Refund] Raw HTTP Status Code: ${response.status}`);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Refund Error] Received non-JSON response (HTML Snippet):', responseText.substring(0, 200));
        throw new Error(`Safepay returned HTML error (${response.status}). Ensure Tracker ID exists in Sandbox.`);
      }

      // Check if Safepay rejected the request
      if (!response.ok) {
        throw new Error(result.message || 'Safepay rejected the refund request.');
      }

      console.log('[Refund] API Fetch Successful!');
      
      setResponseData({
        tracker: trackerId.trim(),
        amountRefunded: amount,
        timestamp: new Date().toLocaleString(),
      });
      setStatus('success');

    } catch (err: any) {
      console.error('[Refund Catch Exception]:', err.message);
      setErrorMessage(err.message || 'Something went wrong.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setTrackerId('');
    setAmount('');
    setStatus('idle');
    setResponseData(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Safepay Refund Portal</Text>
          <Text style={styles.headerSubtitle}>Direct API Fetch Terminal</Text>
        </View>

        {/* SUCCESS VIEW */}
        {status === 'success' && (
          <View style={styles.card}>
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>✓ Refund Disbursed</Text>
            </View>
            
            <View style={styles.receipt}>
              <Text style={styles.receiptTitle}>API RESPONSE DATA</Text>
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Tracker ID:</Text>
                <Text style={styles.receiptValue}>{responseData?.tracker}</Text>
              </View>
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount Refunded:</Text>
                <Text style={styles.receiptAmount}>PKR {responseData?.amountRefunded}</Text>
              </View>
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Timestamp:</Text>
                <Text style={styles.receiptValue}>{responseData?.timestamp}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Process Another Refund</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FORM VIEW */}
        {status !== 'success' && (
          <View style={styles.card}>
            {status === 'error' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Tracker ID Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Safepay Tracker ID</Text>
              <TextInput
                style={styles.input}
                placeholder="track_xxxxx"
                placeholderTextColor="#94a3b8"
                value={trackerId}
                onChangeText={setTrackerId}
                editable={status !== 'submitting'}
                autoCapitalize="none"
              />
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Refund Amount (PKR)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1500.00"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                editable={status !== 'submitting'}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, status === 'submitting' && styles.disabledButton]} 
              onPress={handleDirectRefundSubmit}
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Execute Refund Fetch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContainer: { padding: 20, justifyContent: 'center' },
  header: { marginBottom: 24, alignItems: 'center', marginTop: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, elevation: 8 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#cbd5e1', marginBottom: 6 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, color: '#ffffff', fontSize: 16 },
  submitButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  errorBox: { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#f43f5e', fontSize: 14 },
  successBadge: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  successBadgeText: { color: '#22c55e', fontWeight: 'bold', fontSize: 16 },
  receipt: { backgroundColor: '#0f172a', borderRadius: 10, padding: 16, marginBottom: 20 },
  receiptTitle: { color: '#64748b', fontSize: 12, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptLabel: { color: '#94a3b8', fontSize: 14 },
  receiptValue: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  receiptAmount: { color: '#22c55e', fontSize: 14, fontWeight: 'bold' },
  resetButton: { borderWidth: 1, borderColor: '#334155', padding: 12, borderRadius: 10, alignItems: 'center' },
  resetButtonText: { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
});