/**
 * store/transactions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent transaction store backed by AsyncStorage.
 * Transactions survive app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type TransactionType   = 'payment' | 'subscription';
export type TransactionStatus =
  | 'succeeded'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Transaction {
  id:             string;   // local unique id
  paymentToken:   string;   // Safepay tracker token — used for refunds
  type:           TransactionType;
  description:    string;
  amount:         number;   // PKR
  currency:       string;
  status:         TransactionStatus;
  createdAt:      string;   // ISO string
  refundedAmount: number;
}

// ─── Storage key ──────────────────────────────────────────────────────────────
// v3: clears stale zero-amount records written by earlier buggy versions
const STORAGE_KEY = '@safepay_transactions_v3';

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _cache: Transaction[] = [];

// ─── Load from AsyncStorage (call once on app startup) ───────────────────────
export async function loadTransactions(): Promise<Transaction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) as Transaction[]) : [];
    console.log('[TxStore] loaded', _cache.length, 'transactions from storage');
    _cache.forEach((t) =>
      console.log('[TxStore]  >', t.description, 'PKR', t.amount, '|', t.status, '|', t.paymentToken),
    );
  } catch (e) {
    console.warn('[TxStore] load error:', e);
    _cache = [];
  }
  return _cache;
}

// ─── Persist helper ───────────────────────────────────────────────────────────
async function _persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
    console.log('[TxStore] persisted', _cache.length, 'transactions');
  } catch (e) {
    console.warn('[TxStore] persist error:', e);
  }
}

// ─── Get (sync — cache must be loaded first) ─────────────────────────────────
export function getTransactions(): Transaction[] {
  return [..._cache].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ─── Add ──────────────────────────────────────────────────────────────────────
export async function addTransaction(
  tx: Omit<Transaction, 'id' | 'createdAt' | 'refundedAmount'>,
): Promise<Transaction> {
  console.log('[TxStore] addTransaction:', tx.paymentToken, 'PKR', tx.amount);

  // Deduplicate by token
  const existing = _cache.find((t) => t.paymentToken === tx.paymentToken);
  if (existing) {
    console.log('[TxStore] token exists, skipping:', tx.paymentToken);
    return existing;
  }

  const newTx: Transaction = {
    ...tx,
    id:             `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt:      new Date().toISOString(),
    refundedAmount: 0,
  };

  console.log('[TxStore] added:', newTx.description, 'PKR', newTx.amount);
  _cache.unshift(newTx);
  await _persist();
  return newTx;
}

// ─── Update amount for existing token (fixes zero-amount records) ─────────────
export async function updateTransactionAmount(
  paymentToken: string,
  amount:       number,
): Promise<void> {
  const tx = _cache.find((t) => t.paymentToken === paymentToken);
  if (!tx) return;
  if (tx.amount === amount) return; // already correct
  console.log('[TxStore] updateAmount:', paymentToken, tx.amount, '->', amount);
  tx.amount = amount;
  await _persist();
}

// ─── Mark refunded ────────────────────────────────────────────────────────────
export async function markTransactionRefunded(
  txId:           string,
  refundedAmount: number,
  fullAmount:     number,
): Promise<void> {
  const tx = _cache.find((t) => t.id === txId);
  if (!tx) {
    console.warn('[TxStore] markTransactionRefunded: not found:', txId);
    return;
  }
  tx.refundedAmount += refundedAmount;
  tx.status = tx.refundedAmount >= fullAmount ? 'refunded' : 'partially_refunded';
  console.log('[TxStore] marked refunded:', txId, tx.status, 'refundedAmt:', tx.refundedAmount);
  await _persist();
}

// ─── Clear (debug only) ───────────────────────────────────────────────────────
export async function clearTransactions(): Promise<void> {
  _cache = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[TxStore] cleared all transactions');
}
