import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exportInvoicePdf } from '../api/invoices';
import { getInvoiceById, Invoice } from '../store/invoices';

type Props = {
  invoiceId: string;
  onBack?: () => void;
};

export default function InvoiceScreen({ invoiceId, onBack }: Props) {
  const [busyAction, setBusyAction] = useState<'download' | 'share' | null>(null);
  const invoice = useMemo(() => getInvoiceById(invoiceId), [invoiceId, busyAction]);

  const handleDownload = async () => {
    if (!invoice) return;
    setBusyAction('download');
    try {
      const uri = await exportInvoicePdf(invoice.id);
      Alert.alert('Invoice PDF ready', `Saved to:\n${uri}`);
    } catch (err: any) {
      Alert.alert('Invoice Error', err.message || 'Could not export invoice PDF.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShare = async () => {
    if (!invoice) return;
    setBusyAction('share');
    try {
      const fileUri = await exportInvoicePdf(invoice.id);
      const shareUri =
        Platform.OS === 'android'
          ? await FileSystem.getContentUriAsync(fileUri)
          : fileUri;

      await Share.share({
        title: invoice.invoiceNumber,
        message: `Invoice ${invoice.invoiceNumber} for ${formatAmount(invoice)}\n${shareUri}`,
        url: shareUri,
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share invoice PDF.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Invoice not found</Text>
          {onBack && (
            <TouchableOpacity style={styles.emptyBackBtn} onPress={onBack}>
              <Text style={styles.primaryBtnText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

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
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.subtitle}>{invoice.invoiceNumber}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amount}>{formatAmount(invoice)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <InfoSection title="Customer">
          <InfoRow label="Name" value={invoice.customer.name} />
          <InfoRow label="Email" value={invoice.customer.email} />
          {!!invoice.customer.phone && (
            <InfoRow label="Phone" value={invoice.customer.phone} />
          )}
          {!!invoice.customer.address && (
            <InfoRow label="Address" value={invoice.customer.address} />
          )}
        </InfoSection>

        <InfoSection title="Payment">
          <InfoRow label="Service" value={invoice.serviceDescription} />
          <InfoRow label="Date" value={formatDate(invoice.date)} />
          <InfoRow label="Transaction ID" value={invoice.transactionId} compact />
          <InfoRow label="Payment Token" value={invoice.transactionToken} compact />
        </InfoSection>

        {!!invoice.pdfUri && (
          <View style={styles.pathBox}>
            <Text style={styles.pathLabel}>PDF File</Text>
            <Text style={styles.pathValue} numberOfLines={2}>
              {invoice.pdfUri}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.secondaryBtn, busyAction !== null && styles.disabledBtn]}
          onPress={handleDownload}
          disabled={busyAction !== null}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>
            {busyAction === 'download' ? 'Preparing...' : 'Download PDF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, busyAction !== null && styles.disabledPrimary]}
          onPress={handleShare}
          disabled={busyAction !== null}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {busyAction === 'share' ? 'Preparing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, compact && styles.compactValue]}
        numberOfLines={compact ? 1 : 2}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(invoice: Invoice): string {
  return `${invoice.currency} ${invoice.amount.toLocaleString('en-PK')}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4, fontWeight: '600' },

  content: {
    padding: 16,
    paddingBottom: 120,
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  amount: { color: '#fff', fontSize: 26, fontWeight: '800' },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: { color: '#16A34A', fontSize: 11, fontWeight: '800' },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionBody: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 20,
  },
  compactValue: { fontSize: 12 },
  pathBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
  },
  pathLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  pathValue: { fontSize: 12, color: '#374151', lineHeight: 18 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  secondaryBtnText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  disabledBtn: { borderColor: '#D1D5DB' },
  disabledPrimary: { backgroundColor: '#D1D5DB' },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  emptyBackBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
