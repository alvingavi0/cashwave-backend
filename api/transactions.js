const { query } = require('./_db');
const { verifyFirebaseIdToken } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise(resolve => verifyFirebaseIdToken(req, res, resolve));
  if (!req.uid) return;

  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const q = await query(`SELECT * FROM transactions WHERE uid=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [req.uid, limit, offset]);
    const transactions = q.rows.map(r => ({
      id: r.id,
      uid: r.uid,
      phone: r.phone,
      amount: Number(r.amount),
      type: r.type,
      status: r.status,
      intasendRequestId: r.intasend_request_id,
      intasendTransactionId: r.intasend_transaction_id,
      intasendResponse: r.intasend_response,
      callbackPayload: r.callback_payload,
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const totalDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);

    res.json({ ok: true, transactions, pagination: { page, limit, totalDeposits, totalWithdrawals } });
  } catch (err) {
    console.error('transactions error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
};
