// This route is no longer used in production.
// The frontend uses @sfpy/react-native-sdk which directly calls SafePay's
// order/v1/init endpoint using the client API key — no backend needed.
//
// Kept here only as a reference / for future server-side use.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Use @sfpy/react-native-sdk on the frontend directly.' },
    { status: 200 }
  );
}
