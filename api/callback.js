// api/callback.js
const { db } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body;
    const stkCallback = payload?.Body?.stkCallback || payload?.body?.stkCallback || null;

    // quick ack object to return to Safaricom
    const resultAck = { ResultCode: 0, ResultDesc: 'Accepted' };

    if (!stkCallback) {
      console.log('Callback received with no stkCallback:', JSON.stringify(payload).slice(0,300));
      // store raw callback to collection to inspect
      await db.collection('mpesa_callbacks').add({
        raw: payload,
        createdAt: new Date().toISOString()
      });
      return res.json(resultAck);
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const callbackMetadata = stkCallback.CallbackMetadata || null;

    // Extract some fields
    let mpesaReceipt = null, amount = null, phone = null;
    if (callbackMetadata && Array.isArray(callbackMetadata.Item)) {
      const items = callbackMetadata.Item;
      mpesaReceipt = (items.find(i => i.Name === 'MpesaReceiptNumber') || {}).Value || null;
      amount = (items.find(i => i.Name === 'Amount') || {}).Value || null;
      phone = (items.find(i => i.Name === 'PhoneNumber') || {}).Value || null;
    }

    // Try to find transaction by checkoutRequestID
    let txRef = null;
    if (checkoutRequestID) {
      const q = await db.collection('transactions').where('checkoutRequestID', '==', checkoutRequestID).limit(1).get();
      if (!q.empty) txRef = q.docs[0].ref;
    }

    // Fallback: find pending tx by phone & amount
    if (!txRef && phone && amount) {
      const q2 = await db.collection('transactions')
        .where('phone', '==', phone)
        .where('amount', '==', Number(amount))
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!q2.empty) txRef = q2.docs[0].ref;
    }

    const status = (resultCode === 0) ? 'success' : 'failed';

    if (txRef) {
      await txRef.update({
        status,
        mpesaReceipt,
        callbackRaw: payload,
        updatedAt: new Date().toISOString()
      });

      if (status === 'success') {
        const txDoc = await txRef.get();
        const txData = txDoc.data();
        const uid = txData.uid;
        const creditAmount = Number(txData.amount || amount || 0);

        if (uid) {
          const userRef = db.collection('users').doc(uid);
          await db.runTransaction(async t => {
            const snap = await t.get(userRef);
            const prev = (snap.exists && snap.data().walletBalance) ? Number(snap.data().walletBalance) : 0;
            const next = prev + creditAmount;
            t.set(userRef, { walletBalance: next }, { merge: true });
          });
        }
      }
    } else {
      // Save unmatched callback so you can later reconcile manually
      await db.collection('transactions').add({
        uid: null,
        phone,
        amount,
        type: 'deposit',
        status,
        checkoutRequestID,
        mpesaReceipt,
        callbackRaw: payload,
        createdAt: new Date().toISOString()
      });
    }

    // respond quickly to Safaricom
    return res.json(resultAck);
  } catch (err) {
    console.error('callback error', err);
    return res.status(500).json({ error: err.message || err });
  }
};
