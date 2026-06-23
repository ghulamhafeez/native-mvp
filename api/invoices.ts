/**
 * api/invoices.ts
 * Local backend-style API for issuing invoices and exporting PDF receipts.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { Transaction } from '../store/transactions';
import {
  addInvoice,
  getInvoiceById,
  getInvoiceByTransactionId,
  Invoice,
  InvoiceCustomer,
  updateInvoicePdfUri,
} from '../store/invoices';

const INVOICE_DIR = `${FileSystem.documentDirectory ?? ''}invoices/`;

export const DEFAULT_CUSTOMER: InvoiceCustomer = {
  name: 'SafePay Sandbox Customer',
  email: 'customer@example.com',
  phone: '+92 300 0000000',
  address: 'Sandbox Billing Profile',
};

export interface CreateInvoiceParams {
  transaction: Transaction;
  customer?: InvoiceCustomer;
  serviceDescription?: string;
}

export async function createInvoiceForTransaction(
  params: CreateInvoiceParams | Transaction,
): Promise<Invoice> {
  const normalized =
    'transaction' in params
      ? params
      : { transaction: params, customer: DEFAULT_CUSTOMER };

  const { transaction, customer = DEFAULT_CUSTOMER } = normalized;
  const existing = getInvoiceByTransactionId(transaction.id);
  if (existing) {
    return ensureInvoicePdf(existing);
  }

  const invoice = await addInvoice({
    customer,
    serviceDescription:
      normalized.serviceDescription ?? transaction.description,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.createdAt,
    transactionId: transaction.id,
    transactionToken: transaction.paymentToken,
    status: transaction.status === 'refunded' ? 'refunded' : 'paid',
  });

  return ensureInvoicePdf(invoice);
}

export async function ensureInvoicePdf(invoice: Invoice): Promise<Invoice> {
  const pdfUri = await writeInvoicePdf(invoice);
  await updateInvoicePdfUri(invoice.id, pdfUri);
  return getInvoiceById(invoice.id) ?? { ...invoice, pdfUri };
}

export async function exportInvoicePdf(invoiceId: string): Promise<string> {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  const exported = await ensureInvoicePdf(invoice);
  if (!exported.pdfUri) {
    throw new Error('Could not create invoice PDF');
  }
  return exported.pdfUri;
}

async function writeInvoicePdf(invoice: Invoice): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error('File storage is not available on this device');
  }

  await FileSystem.makeDirectoryAsync(INVOICE_DIR, { intermediates: true });

  const fileName = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
  const fileUri = `${INVOICE_DIR}${fileName}`;
  const pdf = buildPdf(invoice);

  await FileSystem.writeAsStringAsync(fileUri, asciiToBase64(pdf), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

function buildPdf(invoice: Invoice): string {
  const amount = `${invoice.currency} ${invoice.amount.toLocaleString('en-PK')}`;
  const date = new Date(invoice.date).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const lines = [
    textLine('INVOICE', 50, 748, 26, true),
    textLine('SafePay Sandbox', 50, 718, 12),
    textLine(`Invoice Number: ${invoice.invoiceNumber}`, 370, 748, 11, true),
    textLine(`Date: ${date}`, 370, 728, 11),
    textLine(`Status: ${invoice.status.toUpperCase()}`, 370, 708, 11),

    textLine('Bill To', 50, 660, 14, true),
    textLine(invoice.customer.name, 50, 638, 11),
    textLine(invoice.customer.email, 50, 620, 11),
    textLine(invoice.customer.phone ?? '', 50, 602, 11),
    textLine(invoice.customer.address ?? '', 50, 584, 11),

    textLine('Service Description', 50, 534, 13, true),
    textLine(invoice.serviceDescription, 50, 510, 11),

    textLine('Transaction ID', 50, 462, 13, true),
    textLine(invoice.transactionId, 50, 438, 10),
    textLine('Payment Token', 50, 408, 13, true),
    textLine(invoice.transactionToken, 50, 384, 10),

    textLine('Amount', 370, 462, 13, true),
    textLine(amount, 370, 436, 18, true),

    textLine('Thank you for your payment.', 50, 110, 11),
    textLine('This PDF was generated automatically after successful payment.', 50, 92, 9),
  ].join('\n');

  return makePdfDocument(lines);
}

function textLine(
  value: string,
  x: number,
  y: number,
  size: number,
  bold = false,
): string {
  const font = bold ? 'F2' : 'F1';
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function makePdfDocument(content: string): string {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function asciiToBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < input.length; i += 3) {
    const byte1 = input.charCodeAt(i) & 0xff;
    const hasByte2 = i + 1 < input.length;
    const hasByte3 = i + 2 < input.length;
    const byte2 = hasByte2 ? input.charCodeAt(i + 1) & 0xff : 0;
    const byte3 = hasByte3 ? input.charCodeAt(i + 2) & 0xff : 0;
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += hasByte2 ? chars[(triplet >> 6) & 0x3f] : '=';
    output += hasByte3 ? chars[triplet & 0x3f] : '=';
  }

  return output;
}
