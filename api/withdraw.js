const crypto = require('crypto');
const { query, withClient } = require('./_db');
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

    // Use a transaction to create tx and debit wallet atomically
    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    await withClient(async client => {
      // Ensure user exists and has sufficient balance, then debit
      const userRes = await client.query('SELECT wallet_balance FROM users WHERE id=$1 FOR UPDATE', [req.uid]);
      const currentBalance = userRes.rows.length ? Number(userRes.rows[0].wallet_balance || 0) : 0;
      if (amountNum > currentBalance) {
        throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT' });
      }

      // Create transaction
      await client.query(`INSERT INTO transactions(id, uid, phone, amount, type, status, created_at, updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [txId, req.uid, phone, amountNum, 'withdraw', 'pending', now]);

      // Debit wallet
      const newBalance = currentBalance - amountNum;
      await client.query(`INSERT INTO users(id, wallet_balance, last_transaction_at)
        VALUES($1,$2,$3)
        ON CONFLICT (id) DO UPDATE SET wallet_balance = $2, last_transaction_at = $3`, [req.uid, newBalance, now]);
    });

    // Initiate payout with IntaSend (outside DB transaction)
    const payoutPayload = {
      amount: amountNum,
      currency: process.env.CURRENCY || 'KES',
      phone_number: phone,
      api_ref: txId,
      callback_url: process.env.INTASEND_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5000'}/api/callback`
    };

    let intaRes;
    try {
      intaRes = await intasendClient.post('/payout/', payoutPayload);
    } catch (intasendErr) {
      console.error('IntaSend payout error:', intasendErr?.response?.data || intasendErr.message || intasendErr);
      // On failure, reverse the debit and mark transaction failed
      try {
        await query('UPDATE transactions SET status=$1, error=$2, updated_at=$3 WHERE id=$4', ['failed', intasendErr?.response?.data || intasendErr.message, new Date().toISOString(), txId]);
        // Reverse wallet debit
        await query('UPDATE users SET wallet_balance = wallet_balance + $1, last_transaction_at = $2 WHERE id = $3', [amountNum, new Date().toISOString(), req.uid]);
      } catch (e) {
        console.error('Failed to reverse on payout error:', e.message || e);
      }
      return res.status(500).json({ error: 'Payout initiation failed', details: intasendErr?.response?.data || intasendErr.message });
    }

    const intaData = intaRes.data || {};
    await query('UPDATE transactions SET intasend_request_id=$1, intasend_response=$2, updated_at=$3 WHERE id=$4', [intaData.id || null, JSON.stringify(intaData), new Date().toISOString(), txId]);

    return res.json({ ok: true, txnId: txId, intasendRequestId: intaData.id, message: 'Withdrawal initiated. Processing...' });
  } catch (err) {
    if (err.code === 'INSUFFICIENT') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    console.error('Withdraw error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
