/**
 * server/webhooks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Safepay webhook handler — deploy this as a standalone Express server.
 *
 * Setup:
 *   1. npm install express crypto
 *   2. Set SAFEPAY_WEBHOOK_SECRET in your environment
 *   3. Register your endpoint URL in the Safepay dashboard
 *   4. Run: ts-node server/webhooks.ts  (or compile to JS first)
 *
 * Safepay signs each webhook with HMAC-SHA256. We verify the signature
 * before processing any event.
 */

import crypto  from 'crypto';
import express, { Request, Response, NextFunction } from 'express';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Raw body needed for HMAC verification ─────────────────────────────────────
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SafepayWebhookPayload {
  type: string;
  data: {
    token:    string;
    state:    string;
    amount:   number;
    currency: string;
    reason?:  string;
  };
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(
  rawBody:   Buffer,
  signature: string,
  secret:    string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex'),
  );
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function handleRefundSucceeded(data: SafepayWebhookPayload['data']): void {
  console.log('[Webhook] refund.succeeded', {
    token:    data.token,
    amount:   data.amount,
    currency: data.currency,
    reason:   data.reason,
  });

  // TODO: Update your database — mark the transaction as refunded.
  // Example (pseudocode):
  //   await db.transactions.update({
  //     where:  { paymentToken: data.token },
  //     data:   { status: 'refunded', refundedAt: new Date() },
  //   });

  // TODO: Send a confirmation email / push notification to the customer.
}

function handleRefundFailed(data: SafepayWebhookPayload['data']): void {
  console.error('[Webhook] refund.failed', {
    token:  data.token,
    state:  data.state,
    reason: data.reason,
  });

  // TODO: Alert your team, retry logic, or notify the customer.
  // Example (pseudocode):
  //   await notifySupport({ token: data.token, reason: data.reason });
}

// ─── Webhook endpoint ─────────────────────────────────────────────────────────

app.post(
  '/api/webhooks/safepay',
  (req: Request & { rawBody?: Buffer }, res: Response) => {
    const signature = req.headers['x-sfpy-signature'] as string | undefined;
    const secret    = process.env.SAFEPAY_WEBHOOK_SECRET ?? '';

    // 1. Verify signature
    if (!signature || !req.rawBody) {
      res.status(400).json({ error: 'Missing signature or body' });
      return;
    }

    if (!verifySignature(req.rawBody, signature, secret)) {
      console.error('[Webhook] Invalid signature — possible spoofed request');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const payload = req.body as SafepayWebhookPayload;
    console.log('[Webhook] Received event:', payload.type);

    // 2. Route events
    switch (payload.type) {
      case 'refund.succeeded':
        handleRefundSucceeded(payload.data);
        break;

      case 'refund.failed':
        handleRefundFailed(payload.data);
        break;

      default:
        console.log('[Webhook] Unhandled event type:', payload.type);
    }

    // 3. Acknowledge receipt — Safepay expects 200 within 5 s
    res.status(200).json({ received: true });
  }
);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Webhook server] listening on port ${PORT}`);
});

export default app;
