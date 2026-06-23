/**
 * Shared Safepay sandbox configuration.
 *
 * Production apps should keep merchant secrets on a backend and call them from
 * the app through your own authenticated API.
 */

export const SAFEPAY_SANDBOX_URL = 'https://sandbox.api.getsafepay.com';

// Public client key used to create a checkout tracker.
export const SAFEPAY_CLIENT_KEY = 'sec_a2096262-caac-4f82-b581-06b1e4b89937';

// Merchant secret used for privileged server-side actions such as refunds.
export const SAFEPAY_MERCHANT_SECRET =
  'ae022d549fb902451e2a2c174113df7708dc90b77ce485ddc7848b37bdeee8f5';

export function merchantSecretHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-SFPY-MERCHANT-SECRET': SAFEPAY_MERCHANT_SECRET,
  };
}
