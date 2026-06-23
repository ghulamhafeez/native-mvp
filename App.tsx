import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen                from './screens/HomeScreen';
import AmountScreen              from './screens/AmountScreen';
import SubscriptionScreen        from './screens/SubscriptionScreen';
import SubscriptionSuccessScreen from './screens/SubscriptionSuccessScreen';
import TransactionHistoryScreen  from './screens/TransactionHistoryScreen';
import InvoiceHistoryScreen      from './screens/InvoiceHistoryScreen';
import InvoiceScreen             from './screens/InvoiceScreen';
import { getTransactions, loadTransactions } from './store/transactions';
import { loadInvoices }          from './store/invoices';
import { createInvoiceForTransaction } from './api/invoices';
import { seedKnownTrackers }     from './api/trackerLookup';

type Screen =
  | 'home'
  | 'amount'
  | 'subscription'
  | 'subscription-success'
  | 'history'
  | 'invoice-history'
  | 'invoice';

type SubscriptionResult = {
  subscriptionId?: string;
  invoiceId?:      string;
  planId:   string;
  planName: string;
  status:   'active' | 'cancelled';
};

export default function App() {
  const [screen, setScreen]                         = useState<Screen>('home');
  const [subscriptionResult, setSubscriptionResult] = useState<SubscriptionResult | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId]   = useState<string | null>(null);
  const [storeReady, setStoreReady]                 = useState(false);

  const openInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setScreen('invoice');
  };

  // ── On mount: load persisted transactions, then seed known trackers ─────────
  useEffect(() => {
    (async () => {
      await loadTransactions();    // hydrate in-memory cache from AsyncStorage
      await loadInvoices();        // hydrate invoice cache from AsyncStorage
      const paidTransactions = getTransactions().filter(
        (tx) => tx.status === 'succeeded' || tx.status === 'partially_refunded',
      );
      const invoiceResults = await Promise.allSettled(
        paidTransactions.map((tx) => createInvoiceForTransaction(tx)),
      );
      invoiceResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.warn('[Invoice] backfill failed:', result.reason);
        }
      });
      await seedKnownTrackers();   // fetch + add known tracker IDs from Safepay
      setStoreReady(true);
    })();
  }, []);

  // Render nothing until the store is ready to avoid flash of "no transactions"
  if (!storeReady) return null;

  switch (screen) {

    case 'amount':
      return (
        <>
          <StatusBar style="dark" />
          <AmountScreen
            onBack={() => setScreen('home')}
            onInvoiceGenerated={openInvoice}
          />
        </>
      );

    case 'subscription':
      return (
        <>
          <StatusBar style="dark" />
          <SubscriptionScreen
            onSuccess={(result) => {
              setSubscriptionResult(result);
              setScreen('subscription-success');
            }}
            onCancel={() => setScreen('home')}
          />
        </>
      );

    case 'subscription-success':
      return (
        <>
          <StatusBar style="dark" />
          <SubscriptionSuccessScreen
            result={subscriptionResult!}
            onViewInvoice={
              subscriptionResult?.invoiceId
                ? () => openInvoice(subscriptionResult.invoiceId!)
                : undefined
            }
            onHome={() => setScreen('home')}
          />
        </>
      );

    case 'history':
      return (
        <>
          <StatusBar style="dark" />
          <TransactionHistoryScreen
            onBack={() => setScreen('home')}
            onOpenInvoice={openInvoice}
          />
        </>
      );

    case 'invoice-history':
      return (
        <>
          <StatusBar style="dark" />
          <InvoiceHistoryScreen
            onBack={() => setScreen('home')}
            onOpenInvoice={openInvoice}
          />
        </>
      );

    case 'invoice':
      return (
        <>
          <StatusBar style="dark" />
          {selectedInvoiceId ? (
            <InvoiceScreen
              invoiceId={selectedInvoiceId}
              onBack={() => setScreen('invoice-history')}
            />
          ) : (
            <HomeScreen onNavigate={setScreen} />
          )}
        </>
      );

    default: // 'home'
      return (
        <>
          <StatusBar style="dark" />
          <HomeScreen onNavigate={setScreen} />
        </>
      );
  }
}
