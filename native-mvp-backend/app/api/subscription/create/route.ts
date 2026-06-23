import { NextRequest, NextResponse } from 'next/server';
import { Safepay } from '@sfpy/node-sdk';
import { Environment } from '@sfpy/node-sdk/dist/utils';

// ─── Safepay client (sandbox) ─────────────────────────────────────────────────
function getSafepay() {
  const apiKey        = process.env.SAFE_PAY_API_KEY;
  const v1Secret      = process.env.SAFE_PAY_API_SECRET;
  const webhookSecret = process.env.SAFE_PAY_WEBHOOK_SECRET ?? '';

  if (!apiKey || !v1Secret) {
    throw new Error('Missing SAFE_PAY_API_KEY or SAFE_PAY_API_SECRET env vars');
  }

  return new Safepay({
    environment: Environment.Sandbox,
    apiKey,
    v1Secret,
    webhookSecret,
  });
}

// POST /api/subscription/create
// Body: { planId: string, reference?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, reference } = body as { planId?: string; reference?: string };

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'planId is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL;
    const appUrl     = process.env.APP_URL;

    if (!backendUrl || !appUrl) {
      return NextResponse.json(
        { success: false, error: 'BACKEND_URL or APP_URL env var missing' },
        { status: 500 }
      );
    }

    const safepay = getSafepay();

    // createSubscription fetches an auth token internally, then builds the
    // checkout URL — no separate customer creation needed for Safepay subs.
    const checkoutUrl = await safepay.checkout.createSubscription({
      planId,
      redirectUrl: `${backendUrl}/api/subscription/callback?status=success`,
      cancelUrl:   `${backendUrl}/api/subscription/callback?status=cancelled`,
      reference:   reference ?? `ref_${Date.now()}`,
    });

    return NextResponse.json({ success: true, checkoutUrl }, { status: 200 });
  } catch (error) {
    console.error('[subscription/create] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
