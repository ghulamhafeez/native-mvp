import { NextRequest, NextResponse } from 'next/server';
import { Safepay } from '@sfpy/node-sdk';
import { Environment } from '@sfpy/node-sdk/dist/utils';

// POST /api/webhook
//
// Receives Safepay webhook events. Safepay signs each request with
// HMAC-SHA512 over JSON.stringify(body.data), stored in the
// x-sfpy-signature header.
//
// To receive webhooks locally use ngrok:
//   ngrok http 3000
//   Set the tunnel URL in your Safepay dashboard → Webhooks.
export async function POST(request: NextRequest) {
  try {
    const apiKey        = process.env.SAFE_PAY_API_KEY;
    const v1Secret      = process.env.SAFE_PAY_API_SECRET;
    const webhookSecret = process.env.SAFE_PAY_WEBHOOK_SECRET;

    if (!apiKey || !v1Secret || !webhookSecret) {
      console.error('[webhook] Missing Safepay env vars');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const safepay = new Safepay({
      environment: Environment.Sandbox,
      apiKey,
      v1Secret,
      webhookSecret,
    });

    // Parse body — must read as JSON to match the SDK's verification logic.
    const body = await request.json();

    // Reconstruct a request-like object the SDK verify.webhook() expects:
    // { headers: { 'x-sfpy-signature': string }, body: { data: unknown } }
    const sig = request.headers.get('x-sfpy-signature') ?? '';

    const isValid = safepay.verify.webhook({
      headers: { 'x-sfpy-signature': sig },
      body,
    } as any);

    if (!isValid) {
      console.warn('[webhook] Invalid signature — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── Event routing ──────────────────────────────────────────────────────
    const eventType: string = body?.type ?? body?.event ?? '';
    const data              = body?.data ?? {};

    console.log(`[webhook] event: ${eventType}`, JSON.stringify(data));

    switch (eventType) {
      // Subscription activated after first payment
      case 'subscription.activated':
      case 'subscription.created': {
        const subscriptionId: string = data?.id ?? data?.subscription_id ?? '';
        console.log(`[webhook] Subscription activated: ${subscriptionId}`);
        // TODO: persist subscriptionId + customer info to your DB
        break;
      }

      // Recurring payment collected
      case 'payment.created':
      case 'invoice.paid': {
        const subscriptionId: string = data?.subscription ?? data?.subscription_id ?? '';
        const amount: number         = data?.amount ?? 0;
        console.log(`[webhook] Payment collected for subscription ${subscriptionId} — ${amount}`);
        // TODO: update last_paid_at in your DB
        break;
      }

      // Subscription cancelled (by merchant or Safepay)
      case 'subscription.cancelled':
      case 'subscription.deleted': {
        const subscriptionId: string = data?.id ?? data?.subscription_id ?? '';
        console.log(`[webhook] Subscription cancelled: ${subscriptionId}`);
        // TODO: mark subscription as inactive in your DB
        break;
      }

      // Payment failed — subscription may pause
      case 'payment.failed':
      case 'invoice.payment_failed': {
        const subscriptionId: string = data?.subscription ?? data?.subscription_id ?? '';
        console.log(`[webhook] Payment failed for subscription ${subscriptionId}`);
        // TODO: notify user to update payment method
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }

    // Always return 200 quickly so Safepay doesn't retry
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[webhook] error:', error);
    // Return 200 anyway — returning 5xx causes Safepay to retry indefinitely
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
