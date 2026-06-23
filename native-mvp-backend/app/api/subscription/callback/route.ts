import { NextRequest, NextResponse } from 'next/server';

// GET /api/subscription/callback?status=success|cancelled
//
// Safepay redirects back here after checkout. The mobile WebView intercepts
// this URL — we just need a valid HTTP response so the WebView doesn't hang.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'unknown';

  // Return minimal HTML so the WebView renders something while the app
  // intercepts the URL and closes the modal.
  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting…</title></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;
               justify-content:center;height:100vh;margin:0;background:#f9fafb;">
    <p style="font-size:18px;color:#374151;">
      ${status === 'success' ? '✅ Subscription activated!' : '❌ Subscription cancelled.'}
    </p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
