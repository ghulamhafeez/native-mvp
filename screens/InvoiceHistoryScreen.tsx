import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getInvoices, Invoice } from '../store/invoices';

type Props = {
  onBack?: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
};

export default function InvoiceHistoryScreen({ onBack, onOpenInvoice }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const invoices = useMemo(() => getInvoices(), [refreshKey]);

  const renderInvoice = ({ item: invoice }: { item: Invoice }) => (
    <TouchableOpacity
      style={styles.invoiceCard}
      onPress={() => onOpenInvoice?.(invoice.id)}
      activeOpacity={0.85}
    >
      <View style={styles.invoiceTop}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>PDF</Text>
        </View>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.invoiceDesc}>{invoice.serviceDescription}</Text>
          <Text style={styles.invoiceDate}>{formatDate(invoice.date)}</Text>
        </View>
        <View style={styles.invoiceRight}>
          <Text style={styles.invoiceAmount}>{formatAmount(invoice)}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{invoice.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Transaction</Text>
        <Text style={styles.metaValue} numberOfLines={1} ellipsizeMode="middle">
          {invoice.transactionId}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.title}>Invoices</Text>
      </View>

      {invoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No invoices yet</Text>
          <Text style={styles.emptySubtitle}>
            Invoices are generated automatically after successful payments.
          </Text>
        </View>
      ) : (
        <FlatList
          key={refreshKey}
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },

  listContent: { padding: 16, paddingBottom: 40 },
  invoiceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  invoiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 11, fontWeight: '800', color: '#111827' },
  invoiceInfo: { flex: 1 },
  invoiceNumber: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 3 },
  invoiceDesc: { fontSize: 13, color: '#6B7280', marginBottom: 3 },
  invoiceDate: { fontSize: 12, color: '#9CA3AF' },
  invoiceRight: { alignItems: 'flex-end', gap: 5 },
  invoiceAmount: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#DCFCE7',
  },
  statusText: { fontSize: 11, fontWeight: '800', color: '#16A34A', textTransform: 'capitalize' },
  metaRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  metaLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: { fontSize: 12, color: '#374151', fontWeight: '600' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
