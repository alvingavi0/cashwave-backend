const { query } = require('./_db');
const { verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  try {
    const r = await query('SELECT wallet_balance FROM users WHERE id = $1', [req.uid]);
    const walletBalance = r.rows.length ? Number(r.rows[0].wallet_balance || 0) : 0;
    res.json({ ok: true, walletBalance, uid: req.uid });
  } catch (err) {
    console.error('balance error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
};
