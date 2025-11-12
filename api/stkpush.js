// api/stkpush.js
const axios = require('axios');
const { db, verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // verify token
  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return; // verify already responded

  const { phone, amount, serviceName } = req.body || {};
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

  try {
    // Create pending transaction
    const txRef = db.collection('transactions').doc();
    const txData = {
      uid: req.uid,
      phone,
      amount: Number(amount),
      serviceName: serviceName || 'CashWave',
      type: 'deposit',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await txRef.set(txData);

    // Get Daraja access token
    const darajaBase = process.env.DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke';
    const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
    const authRes = await axios.get(`${darajaBase}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    const accessToken = authRes.data.access_token;

    // Build STK push payload
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14); // YYYYMMDDHHmmss
    const password = Buffer.from(`${process.env.BUSINESS_SHORTCODE}${process.env.PASSKEY}${timestamp}`).toString('base64');

    const body = {
      BusinessShortCode: process.env.BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(amount),
      PartyA: phone,
      PartyB: process.env.BUSINESS_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: serviceName || 'CashWave',
      TransactionDesc: `Deposit to CashWave`
    };

    const stkRes = await axios.post(`${darajaBase}/mpesa/stkpush/v1/processrequest`, body, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Store Daraja response & CheckoutRequestID
    const darajaData = stkRes.data || {};
    await txRef.update({
      darajaResponse: darajaData,
      checkoutRequestID: darajaData.CheckoutRequestID || null,
      updatedAt: new Date().toISOString()
    });

    return res.json({ ok: true, txnId: txRef.id, daraja: darajaData });
  } catch (err) {
    console.error('STKPush error', err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data || err.message });
  }
};
