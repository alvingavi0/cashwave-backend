// api/balance.js
const { db, verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  try {
    const userRef = db.collection('users').doc(req.uid);
    const doc = await userRef.get();
    const walletBalance = (doc.exists && doc.data().walletBalance) ? Number(doc.data().walletBalance) : 0;
    res.json({ ok: true, walletBalance });
  } catch (err) {
    console.error('balance error', err);
    res.status(500).json({ error: err.message });
  }
};
