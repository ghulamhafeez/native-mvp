import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get SafePay credentials from environment
    const apiKey = process.env.SAFE_PAY_API_KEY;
    const safepayBaseUrl = process.env.SAFE_PAY_BASE_URL;

    if (!apiKey || !safepayBaseUrl) {
      return NextResponse.json(
        { success: false, error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    // Call SafePay API to get order details
    const response = await fetch(`${safepayBaseUrl}/payment/order/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    console.log('SafePay Status Response:', data);

    if (data.code === 200 && data.data) {
      // Map SafePay status to app status
      let status = 'pending';
      
      if (data.data.status === 'COMPLETED' || data.data.status === 'completed') {
        status = 'paid';
      } else if (data.data.status === 'FAILED' || data.data.status === 'failed') {
        status = 'failed';
      } else if (data.data.status === 'CANCELLED' || data.data.status === 'cancelled') {
        status = 'cancelled';
      }

      return NextResponse.json(
        {
          success: true,
          orderId: data.data.id,
          status,
          amount: data.data.amount,
          currency: data.data.currency,
          createdAt: data.data.created_at,
          updatedAt: data.data.updated_at,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Order not found',
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Order status API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
