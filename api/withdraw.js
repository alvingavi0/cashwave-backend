// api/withdrawal.js
const axios = require('axios');
const { db, verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  const { phone, amount } = req.body || {};
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

  try {
    // Check balance
    const userRef = db.collection('users').doc(req.uid);
    const userDoc = await userRef.get();
    const balance = (userDoc.exists && userDoc.data().walletBalance) ? Number(userDoc.data().walletBalance) : 0;
    if (Number(amount) > balance) return res.status(400).json({ error: 'Insufficient balance' });

    // Create pending withdraw transaction
    const txRef = db.collection('transactions').doc();
    await txRef.set({
      uid: req.uid,
      phone,
      amount: Number(amount),
      type: 'withdraw',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Get Daraja token
    const darajaBase = process.env.DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke';
    const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
    const authRes = await axios.get(`${darajaBase}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    const accessToken = authRes.data.access_token;

    // B2C body - requires SecurityCredential (encrypted initiator password)
    const body = {
      InitiatorName: process.env.INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL, // must be set in env
      CommandID: 'BusinessPayment',
      Amount: Number(amount),
      PartyA: process.env.BUSINESS_SHORTCODE,
      PartyB: phone,
      Remarks: 'CashWave Wallet withdrawal',
      QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
      ResultURL: process.env.MPESA_CALLBACK_URL
    };

    const b2cRes = await axios.post(`${darajaBase}/mpesa/b2c/v1/paymentrequest`, body, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    await txRef.update({ darajaResponse: b2cRes.data, updatedAt: new Date().toISOString() });

    // Do not debit user's balance yet — only after success callback.
    res.json({ ok: true, txId: txRef.id, daraja: b2cRes.data });
  } catch (err) {
    console.error('withdraw error', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};
