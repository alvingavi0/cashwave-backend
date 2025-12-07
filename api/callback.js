const { withClient } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body || {};
    console.log('Callback payload (truncated):', JSON.stringify(payload).slice(0, 800));

    const apiRef = payload?.api_ref || payload?.id || payload?.transaction_id;
    const status = payload?.status || 'pending';
    const amount = payload?.amount != null ? Number(payload.amount) : null;

    // Acknowledge quickly
    res.json({ status: 'ok' });

    if (!apiRef) {
      console.log('Callback missing api_ref; ignoring');
      return;
    }

    // Process callback in a DB transaction for atomicity
    await withClient(async client => {
      // Find transaction
      const txRes = await client.query('SELECT * FROM transactions WHERE id=$1 FOR UPDATE', [apiRef]);
      if (!txRes.rows.length) {
        console.log('Transaction not found for api_ref', apiRef);
        return;
      }
      const tx = txRes.rows[0];

      const updatedAt = new Date().toISOString();

      // Update transaction record
      await client.query(`UPDATE transactions SET intasend_transaction_id=$1, status=$2, callback_payload=$3, updated_at=$4 WHERE id=$5`,
        [payload.id || null, status, JSON.stringify(payload), updatedAt, apiRef]);

      if ((status === 'completed' || status === 'success') && tx.status !== 'success') {
        // Credit user's wallet
        const amt = amount != null ? amount : Number(tx.amount || 0);
        await client.query(`INSERT INTO users(id, wallet_balance, last_transaction_at)
          VALUES($1,$2,$3)
          ON CONFLICT (id) DO UPDATE SET wallet_balance = users.wallet_balance + EXCLUDED.wallet_balance, last_transaction_at = EXCLUDED.last_transaction_at`,
          [tx.uid, amt, updatedAt]);
      }
    });
  } catch (err) {
    console.error('Callback processing error:', err.message || err);
  }
};
