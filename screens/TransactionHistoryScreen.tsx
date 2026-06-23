/**
 * screens/TransactionHistoryScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lists all transactions and lets the user issue full or partial refunds.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRefund, RefundType }         from '../api/refund';
import { createInvoiceForTransaction }      from '../api/invoices';
import { getInvoiceByTransactionId }        from '../store/invoices';
import {
  getTransactions,
  markTransactionRefunded,
  Transaction,
} from '../store/transactions';

// ─── Types ────────────────────────────────────────────────────────────────────

type RefundMode = 'full' | 'partial';

interface RefundState {
  visible:    boolean;
  tx:         Transaction | null;
  mode:       RefundMode;
  partialAmt: string;
  loading:    boolean;
  error:      string | null;
  success:    boolean;
  refundId:   string | null;
}

const INITIAL_REFUND: RefundState = {
  visible:    false,
  tx:         null,
  mode:       'full',
  partialAmt: '',
  loading:    false,
  error:      null,
  success:    false,
  refundId:   null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

function formatAmount(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}

function statusColor(status: Transaction['status']): string {
  switch (status) {
    case 'succeeded':          return '#16A34A';
    case 'refunded':           return '#9CA3AF';
    case 'partially_refunded': return '#D97706';
    case 'failed':             return '#DC2626';
    default:                   return '#6B7280';
  }
}

function statusLabel(status: Transaction['status']): string {
  switch (status) {
    case 'succeeded':          return 'Succeeded';
    case 'refunded':           return 'Refunded';
    case 'partially_refunded': return 'Partial Refund';
    case 'failed':             return 'Failed';
    default:                   return 'Pending';
  }
}

function canRefund(tx: Transaction): boolean {
  return tx.status === 'succeeded' || tx.status === 'partially_refunded';
}

function remainingAmount(tx: Transaction): number {
  return tx.amount - tx.refundedAmount;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  onBack?: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TransactionHistoryScreen({ onBack, onOpenInvoice }: Props) {
  // refreshKey drives re-reads of the transaction store.
  // Starts at 0; bumped on mount (so we always get fresh data when navigating
  // to this screen) and again after each successful refund.
  const [refreshKey, setRefreshKey] = useState(0);
  const [refund, setRefund]         = useState<RefundState>(INITIAL_REFUND);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  // Bump on mount → triggers the useMemo below to read the store immediately.
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Re-read the store every time refreshKey changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const transactions = useMemo(() => getTransactions(), [refreshKey]);

  // ── Open refund modal ──────────────────────────────────────────────────────
  const openRefundModal = useCallback((tx: Transaction) => {
    setRefund({ ...INITIAL_REFUND, visible: true, tx });
  }, []);

  const closeRefundModal = useCallback(() => {
    setRefund(INITIAL_REFUND);
  }, []);

  const handleOpenInvoice = async (tx: Transaction) => {
    if (!onOpenInvoice || invoiceLoadingId) return;

    setInvoiceLoadingId(tx.id);
    try {
      const invoice = getInvoiceByTransactionId(tx.id) ?? await createInvoiceForTransaction(tx);
      onOpenInvoice(invoice.id);
    } catch (err: any) {
      Alert.alert('Invoice Error', err.message || 'Could not open invoice.');
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  // ── Validate partial amount ────────────────────────────────────────────────
  const parsedPartial = parseFloat(refund.partialAmt.replace(/,/g, ''));
  const remaining     = refund.tx ? remainingAmount(refund.tx) : 0;
  const partialValid  = !isNaN(parsedPartial) && parsedPartial > 0 && parsedPartial <= remaining;

  const canSubmit =
    !refund.loading &&
    !refund.success &&
    (refund.mode === 'full' || partialValid);

  // ── Submit refund ──────────────────────────────────────────────────────────
  const handleSubmitRefund = async () => {
    if (!refund.tx || !canSubmit) return;

    const tx         = refund.tx;
    const isPartial  = refund.mode === 'partial';
    const refundAmt  = isPartial ? parsedPartial : remaining;
    const refundType: RefundType = isPartial ? 'partial' : 'full';

    setRefund((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await createRefund({
        paymentToken: tx.paymentToken,
        amount:       isPartial ? refundAmt : undefined,
        reason:       isPartial ? 'Partial refund requested' : 'Full refund requested',
        type:         refundType,
      });

      // Update local store
      await markTransactionRefunded(tx.id, refundAmt, tx.amount);

      setRefund((prev) => ({
        ...prev,
        loading:  false,
        success:  true,
        refundId: result.refundId,
        error:    null,
      }));

      // Refresh the list
      setRefreshKey((k) => k + 1);

    } catch (err: any) {
      console.error('[Refund] error:', err.message);
      setRefund((prev) => ({
        ...prev,
        loading: false,
        error:   err.message || 'Refund failed. Please try again.',
      }));
    }
  };

  // ── Render transaction card ────────────────────────────────────────────────
  const renderTransaction = ({ item: tx }: { item: Transaction }) => (
    <View style={styles.txCard} key={tx.id}>
      <View style={styles.txTop}>
        <View style={styles.txIconBox}>
          <Text style={styles.txIcon}>{tx.type === 'subscription' ? '🔄' : '💳'}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc}>{tx.description}</Text>
          <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txAmount}>{formatAmount(tx.amount)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(tx.status) + '1A' }]}>
            <Text style={[styles.statusText, { color: statusColor(tx.status) }]}>
              {statusLabel(tx.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Show refunded amount if partially refunded */}
      {tx.refundedAmount > 0 && (
        <Text style={styles.txRefundNote}>
          ↩ {formatAmount(tx.refundedAmount)} refunded
          {tx.status === 'partially_refunded'
            ? ` · ${formatAmount(remainingAmount(tx))} remaining`
            : ''}
        </Text>
      )}

      {(onOpenInvoice || canRefund(tx)) && (
        <View style={styles.actionRow}>
          {onOpenInvoice && tx.status !== 'failed' && tx.status !== 'pending' && (
            <TouchableOpacity
              style={styles.invoiceBtn}
              onPress={() => handleOpenInvoice(tx)}
              activeOpacity={0.8}
              disabled={invoiceLoadingId !== null}
            >
              <Text style={styles.invoiceBtnText}>
                {invoiceLoadingId === tx.id ? 'Opening...' : 'Invoice'}
              </Text>
            </TouchableOpacity>
          )}

          {canRefund(tx) && (
            <TouchableOpacity
              style={styles.refundBtn}
              onPress={() => openRefundModal(tx)}
              activeOpacity={0.8}
            >
              <Text style={styles.refundBtnText}>↩ Refund</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Transactions</Text>
      </View>

      {/* List */}
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete a payment or subscription to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          key={refreshKey}
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Refund Modal ── */}
      <Modal
        visible={refund.visible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeRefundModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeRefundModal}
          />

          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* ── Success state ── */}
            {refund.success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Refund Initiated</Text>
                <Text style={styles.successSub}>
                  Your refund has been submitted successfully.
                </Text>
                {refund.refundId && (
                  <View style={styles.refundIdBox}>
                    <Text style={styles.refundIdLabel}>Refund ID</Text>
                    <Text style={styles.refundIdValue} numberOfLines={1}>
                      {refund.refundId}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.doneBtn} onPress={closeRefundModal}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Refund form ── */
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Title */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Request Refund</Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={closeRefundModal}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalCloseTxt}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Transaction summary */}
                {refund.tx && (
                  <View style={styles.txSummary}>
                    <Text style={styles.txSummaryDesc}>{refund.tx.description}</Text>
                    <Text style={styles.txSummaryAmt}>{formatAmount(refund.tx.amount)}</Text>
                    {refund.tx.refundedAmount > 0 && (
                      <Text style={styles.txSummaryRemaining}>
                        Remaining: {formatAmount(remaining)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Refund type selector */}
                <Text style={styles.sectionLabel}>REFUND TYPE</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeBtn, refund.mode === 'full' && styles.modeBtnActive]}
                    onPress={() => setRefund((p) => ({ ...p, mode: 'full', error: null }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modeBtnIcon]}>💯</Text>
                    <Text style={[styles.modeBtnLabel, refund.mode === 'full' && styles.modeBtnLabelActive]}>
                      Full Refund
                    </Text>
                    <Text style={[styles.modeBtnSub, refund.mode === 'full' && styles.modeBtnSubActive]}>
                      {refund.tx ? formatAmount(remaining) : ''}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeBtn, refund.mode === 'partial' && styles.modeBtnActive]}
                    onPress={() => setRefund((p) => ({ ...p, mode: 'partial', error: null }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modeBtnIcon}>✂️</Text>
                    <Text style={[styles.modeBtnLabel, refund.mode === 'partial' && styles.modeBtnLabelActive]}>
                      Partial
                    </Text>
                    <Text style={[styles.modeBtnSub, refund.mode === 'partial' && styles.modeBtnSubActive]}>
                      Enter amount
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Partial amount input */}
                {refund.mode === 'partial' && (
                  <View style={styles.partialSection}>
                    <Text style={styles.sectionLabel}>REFUND AMOUNT (PKR)</Text>
                    <View style={styles.partialInputRow}>
                      <Text style={styles.partialCurrency}>PKR</Text>
                      <TextInput
                        style={[
                          styles.partialInput,
                          refund.partialAmt.length > 0 && !partialValid && styles.partialInputError,
                        ]}
                        placeholder="0"
                        placeholderTextColor="#D1D5DB"
                        value={refund.partialAmt}
                        onChangeText={(t) =>
                          setRefund((p) => ({ ...p, partialAmt: t, error: null }))
                        }
                        keyboardType="numeric"
                        maxLength={10}
                        returnKeyType="done"
                      />
                    </View>
                    {refund.partialAmt.length > 0 && !partialValid && (
                      <Text style={styles.inputErrorText}>
                        Enter a valid amount up to {formatAmount(remaining)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Error message */}
                {refund.error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{refund.error}</Text>
                  </View>
                )}

                {/* Submit button */}
                <TouchableOpacity
                  style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                  onPress={handleSubmitRefund}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                >
                  {refund.loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.submitBtnText}>  Processing Refund...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {refund.mode === 'full'
                        ? `Refund ${refund.tx ? formatAmount(remaining) : ''}`
                        : partialValid
                        ? `Refund PKR ${parsedPartial.toLocaleString('en-PK')}`
                        : 'Confirm Refund'}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.refundNote}>
                  🔒  Refunds are processed securely via SafePay
                </Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn:     { marginBottom: 8 },
  backBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  title:       { fontSize: 24, fontWeight: '800', color: '#111827' },

  // ── List ──
  listContent: { padding: 16, paddingBottom: 40 },

  // ── Transaction card ──
  txCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  txTop: {
    flexDirection:  'row',
    alignItems:     'center',
    gap: 12,
  },
  txIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIcon:   { fontSize: 20 },
  txInfo:   { flex: 1 },
  txDesc:   { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  txDate:   { fontSize: 12, color: '#9CA3AF' },
  txRight:  { alignItems: 'flex-end', gap: 5 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },

  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  txRefundNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },

  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  invoiceBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  invoiceBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  refundBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  refundBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon:     { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // ── Refund modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom: 16,
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalCloseBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // Transaction summary in modal
  txSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 20,
  },
  txSummaryDesc:      { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  txSummaryAmt:       { fontSize: 22, fontWeight: '800', color: '#111827' },
  txSummaryRemaining: { fontSize: 13, color: '#D97706', fontWeight: '600', marginTop: 4 },

  // Mode selector
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  modeBtnActive: {
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  modeBtnIcon:  { fontSize: 22 },
  modeBtnLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  modeBtnLabelActive: { color: '#111827' },
  modeBtnSub:   { fontSize: 12, color: '#9CA3AF' },
  modeBtnSubActive: { color: '#374151' },

  // Partial amount input
  partialSection: { marginBottom: 20 },
  partialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  partialCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  partialInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    padding: 0,
  },
  partialInputError: {
    color: '#DC2626',
  },
  inputErrorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // Error box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '600' },

  // Submit button
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  submitBtnDisabled: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow:    { flexDirection: 'row', alignItems: 'center' },
  refundNote:    { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // ── Success state ──
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  successIcon:  { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successSub:   { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  refundIdBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 24,
  },
  refundIdLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 4 },
  refundIdValue: { fontSize: 13, fontWeight: '600', color: '#374151' },
  doneBtn: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
