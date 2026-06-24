const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Agar Node v18+ hai toh built-in fetch bhi chalega

const app = express();
app.use(express.json());
app.use(cors());

// Safepay Secret Key env variables mein honi chahiye
const SAFEPAY_SECRET_KEY = process.env.SAFEPAY_SECRET_KEY || 'ae022d549fb902451e2a2c174113df7708dc90b77ce485ddc7848b37bdeee8f5';

app.post('/api/v1/payments/refund', async (req, res) => {
  try {
    const { tracker, amount, currency, reason } = req.body;

    if (!tracker || !amount) {
      return res.status(400).json({ success: false, message: 'Missing Tracker ID or Amount' });
    }

    console.log(`[Backend] Processing refund for Tracker: ${tracker}, Amount: ${amount}`);

    const safepayResponse = await fetch('https://sandbox.api.safepaypayments.com/v1/disbursements/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SFPY-MERCHANT-SECRET': SAFEPAY_SECRET_KEY
      },
      body: JSON.stringify({ tracker, amount, currency, reason }),
    });

    const responseText = await safepayResponse.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return res.status(safepayResponse.status).json({
        success: false,
        message: 'Safepay returned an invalid response format (HTML).'
      });
    }

    if (!safepayResponse.ok) {
      return res.status(safepayResponse.status).json({
        success: false,
        message: result.message || 'Safepay rejected the refund request.'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Backend Catch Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Secure Server running on port ${PORT}`));