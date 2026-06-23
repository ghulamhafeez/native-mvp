/**
 * store/invoices.ts
 * Persistent invoice store backed by AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type InvoiceStatus = 'issued' | 'paid' | 'refunded' | 'void';

export interface InvoiceCustomer {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: InvoiceCustomer;
  serviceDescription: string;
  amount: number;
  currency: string;
  date: string;
  transactionId: string;
  transactionToken: string;
  status: InvoiceStatus;
  pdfUri?: string;
  createdAt: string;
}

const STORAGE_KEY = '@safepay_invoices_v1';

let _cache: Invoice[] = [];

export async function loadInvoices(): Promise<Invoice[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) as Invoice[]) : [];
    console.log('[InvoiceStore] loaded', _cache.length, 'invoices from storage');
  } catch (e) {
    console.warn('[InvoiceStore] load error:', e);
    _cache = [];
  }
  return _cache;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
    console.log('[InvoiceStore] persisted', _cache.length, 'invoices');
  } catch (e) {
    console.warn('[InvoiceStore] persist error:', e);
  }
}

export function getInvoices(): Invoice[] {
  return [..._cache].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function getInvoiceById(id: string): Invoice | undefined {
  return _cache.find((invoice) => invoice.id === id);
}

export function getInvoiceByTransactionId(transactionId: string): Invoice | undefined {
  return _cache.find((invoice) => invoice.transactionId === transactionId);
}

export async function addInvoice(
  invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>,
): Promise<Invoice> {
  const existing = getInvoiceByTransactionId(invoice.transactionId);
  if (existing) {
    console.log('[InvoiceStore] transaction already invoiced:', invoice.transactionId);
    return existing;
  }

  const newInvoice: Invoice = {
    ...invoice,
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    invoiceNumber: nextInvoiceNumber(invoice.date),
    createdAt: new Date().toISOString(),
  };

  _cache.unshift(newInvoice);
  await persist();
  return newInvoice;
}

export async function updateInvoicePdfUri(invoiceId: string, pdfUri: string): Promise<void> {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return;
  invoice.pdfUri = pdfUri;
  await persist();
}

export async function clearInvoices(): Promise<void> {
  _cache = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[InvoiceStore] cleared all invoices');
}

function nextInvoiceNumber(dateIso: string): string {
  const day = dateIso.slice(0, 10).replace(/-/g, '');
  const countForDay = _cache.filter((invoice) => invoice.invoiceNumber.includes(day)).length + 1;
  return `INV-${day}-${String(countForDay).padStart(4, '0')}`;
}
