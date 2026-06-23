import { NextRequest, NextResponse } from 'next/server';
import { Safepay } from '@sfpy/node-sdk';
import { Environment } from '@sfpy/node-sdk/dist/utils';

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

// POST /api/subscription/cancel
// Body: { subscriptionId: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId } = body as { subscriptionId?: string };

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'subscriptionId is required' },
        { status: 400 }
      );
    }

    const safepay = getSafepay();

    // Uses X-SFPY-MERCHANT-SECRET header internally (v1Secret)
    const result = await safepay.subscription.cancel(subscriptionId);

    return NextResponse.json({ success: true, subscription: result }, { status: 200 });
  } catch (error) {
    console.error('[subscription/cancel] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
