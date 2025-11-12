// api/transactions.js
const { db, verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  try {
    const q = await db.collection('transactions')
      .where('uid', '==', req.uid)
      .orderBy('createdAt', 'desc')
      .limit(200).get();

    const transactions = q.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ ok: true, transactions });
  } catch (err) {
    console.error('transactions error', err);
    res.status(500).json({ error: err.message });
  }
};
