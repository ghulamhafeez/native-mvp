/**
 * api/trackerLookup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds known historical transactions into the local store.
 *
 * NOTE: Safepay sandbox returns "cannot find tracker" for these tokens when
 * queried via API — they are either expired or under a different merchant.
 * Amounts are hardcoded from the actual payments that were made.
 *
 * HOW TO UPDATE: Edit the `amount` field in KNOWN_TRANSACTIONS below to match
 * your real payment amounts. Each entry maps one tracker token to its PKR amount.
 */

import { addTransaction, updateTransactionAmount, Transaction } from '../store/transactions';

// ─── Known transactions — hardcoded because sandbox API can't retrieve them ───
interface KnownTx {
  token:       string;
  amount:      number;               // PKR — set this to the real payment amount
  type:        Transaction['type'];
  description: string;
  status:      Transaction['status'];
}

export const KNOWN_TRANSACTIONS: KnownTx[] = [
  {
    token:       'track_6bf35e94-9fd1-4155-a94a-7cb449e3c9e0',
    amount:      500,                // PKR 500 — confirmed from screenshot
    type:        'payment',
    description: 'One-Time Payment',
    status:      'succeeded',
  },
  {
    token:       'track_26e38cf2-0d6d-4c2b-a2f6-4840de6a745e',
    amount:      500,                // ← change if this was a different amount
    type:        'payment',
    description: 'One-Time Payment',
    status:      'succeeded',
  },
  {
    token:       'track_db1f9b9d-644c-4008-a89d-8879458219d5',
    amount:      500,                // ← change if this was a different amount
    type:        'payment',
    description: 'One-Time Payment',
    status:      'succeeded',
  },
];

// ─── Seed all known transactions ──────────────────────────────────────────────
export async function seedKnownTrackers(): Promise<void> {
  console.log('[TrackerLookup] seeding', KNOWN_TRANSACTIONS.length, 'known transactions...');

  for (const tx of KNOWN_TRANSACTIONS) {
    // addTransaction deduplicates by token — if it already exists it skips.
    // updateTransactionAmount fixes any existing record that was saved with 0.
    await addTransaction({
      paymentToken: tx.token,
      type:         tx.type,
      description:  tx.description,
      amount:       tx.amount,
      currency:     'PKR',
      status:       tx.status,
    });

    // Also patch any existing record with amount=0 (from old buggy version)
    await updateTransactionAmount(tx.token, tx.amount);

    console.log('[TrackerLookup] seeded:', tx.token, 'PKR', tx.amount);
  }

  console.log('[TrackerLookup] ✅ seeding complete');
}

// ─── Seed a single tracker (call this after any new payment) ─────────────────
export async function seedTracker(
  token:       string,
  amount:      number,
  type:        Transaction['type']   = 'payment',
  description: string                = 'One-Time Payment',
  status:      Transaction['status'] = 'succeeded',
): Promise<void> {
  console.log('[TrackerLookup] seedTracker:', token, 'PKR', amount);
  await addTransaction({
    paymentToken: token,
    type,
    description,
    amount,
    currency: 'PKR',
    status,
  });
}
