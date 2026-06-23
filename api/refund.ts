/**
 * api/refund.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Safepay Refund API — direct HTTP calls matching the official node-core SDK.
 *
 * Confirmed from Safepay's open-source SDK source:
 *   github.com/getsafepay/node-core/blob/main/src/resources/Order/Cancel.ts  → endpoint
 *   github.com/getsafepay/node-core/blob/main/src/RequestSender.ts           → auth header
 *
 * Endpoint:  POST /order/payments/v3/{tracker}/refund
 * Auth:      X-SFPY-MERCHANT-SECRET: <merchant secret>   (authType: 'secret')
 * Body:      { currency: string, amount?: number }  — omit amount for full refund
 */

import { merchantSecretHeaders, SAFEPAY_SANDBOX_URL } from './safepayConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RefundType   = 'full' | 'partial' | 'subscription';
export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface CreateRefundParams {
  paymentToken: string;
  amount?:      number;
  reason?:      string;
  type?:        RefundType;
}

export interface RefundResult {
  refundId:  string;
  status:    RefundStatus;
  amount:    number;
  currency:  string;
  reason:    string;
  createdAt: string;
}

// ─── Safe response reader ─────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error('[Refund] Non-JSON response body:', text.slice(0, 200));
    throw new Error(`Safepay returned an unexpected response (HTTP ${res.status})`);
  }
}

// ─── Core: create a refund ────────────────────────────────────────────────────

export async function createRefund(params: CreateRefundParams): Promise<RefundResult> {
  const { paymentToken, amount, reason = 'Customer requested refund', type = 'full' } = params;

  console.log('[Refund] createRefund — token:', paymentToken, 'amount:', amount, 'type:', type);

  const body: Record<string, unknown> = { currency: 'PKR' };
  if (type === 'partial' && amount && amount > 0) {
    body.amount = amount;
  }

  const url = `${SAFEPAY_SANDBOX_URL}/order/payments/v3/${paymentToken}/refund`;
  console.log('[Refund] POST', url, JSON.stringify(body));

  const res = await fetch(url, {
    method:  'POST',
    headers: merchantSecretHeaders(),
    body: JSON.stringify(body),
  });

  const json = await safeJson(res);
  console.log('[Refund] API response (HTTP', res.status, '):', JSON.stringify(json));

  if (!res.ok) {
    throw new Error(readSafepayError(json, `Refund failed (HTTP ${res.status})`));
  }

  const tracker = json?.data?.tracker ?? json?.data ?? {};

  return {
    refundId:  tracker.token ?? `ref_${Date.now()}`,
    status:    tracker.state === 'TRACKER_REFUNDED'       ? 'succeeded'
             : tracker.state === 'TRACKER_PARTIAL_REFUND' ? 'succeeded'
             : 'pending',
    amount:    tracker.purchase_totals?.base_amount?.amount   ?? (amount ?? 0),
    currency:  tracker.purchase_totals?.base_amount?.currency ?? 'PKR',
    reason,
    createdAt: new Date().toISOString(),
  };
}

function readSafepayError(json: any, fallback: string): string {
  const errors = json?.status?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const message = errors.join(', ');
    if (message.includes('Resource with this identifier not found')) {
      return 'Refund authorization failed. Check that SAFEPAY_MERCHANT_SECRET belongs to the same sandbox merchant that created this tracker.';
    }
    if (message.includes('merchant api key not found') || message.includes('merchant webhook secret not found')) {
      return 'Refund authorization failed. The merchant secret header was not accepted by Safepay.';
    }
    return message;
  }
  return json?.message || fallback;
}

// ─── Subscription refund ─────────────────────────────────────────────────────

export async function createSubscriptionRefund(
  paymentToken: string,
  reason = 'Subscription cancelled',
): Promise<RefundResult> {
  return createRefund({ paymentToken, reason, type: 'subscription' });
}

// ─── Webhook event types ──────────────────────────────────────────────────────

export interface SafepayWebhookEvent {
  type: 'refund.succeeded' | 'refund.failed' | string;
  data: {
    token:    string;
    state:    string;
    amount:   number;
    currency: string;
    reason:   string;
  };
}
