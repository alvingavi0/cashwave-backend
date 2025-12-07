const crypto = require('crypto');
const { query } = require('./_db');
const { verifyFirebaseIdToken, intasendClient } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  const { phone, amount } = req.body || {};
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

  try {
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert transaction record
    await query(`INSERT INTO transactions(id, uid, phone, amount, type, status, created_at, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [txId, req.uid, phone, amountNum, 'deposit', 'pending', now]);

    // Prepare IntaSend payload
    const paymentPayload = {
      amount: amountNum,
      currency: process.env.CURRENCY || 'KES',
      phone_number: phone,
      api_ref: txId,
      callback_url: process.env.INTASEND_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5000'}/api/callback`
    };

    const intaRes = await intasendClient.post('/payment/', paymentPayload);
    const intaData = intaRes.data || {};

    // Store IntaSend response
    await query(`UPDATE transactions SET intasend_request_id=$1, intasend_response=$2, updated_at=$3 WHERE id=$4`,
      [intaData.id || null, JSON.stringify(intaData), new Date().toISOString(), txId]);

    return res.json({ ok: true, txnId: txId, intasendRequestId: intaData.id, message: 'Payment initiated. Awaiting confirmation.' });
  } catch (err) {
    console.error('STK Push error:', err?.response?.data || err.message || err);
    return res.status(500).json({ error: err?.response?.data || err.message || 'Internal error' });
  }
};
