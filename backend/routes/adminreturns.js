const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, o.total_amount, o.payment_method, u.username, u.email
       FROM returns r
       JOIN orders o ON o.order_id = r.order_id
       JOIN users u ON u.user_id = r.customer_id
       ORDER BY r.requested_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching returns:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body; // 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const returnRes = await client.query('SELECT * FROM returns WHERE return_id = $1 FOR UPDATE', [id]);
    const returnRow = returnRes.rows[0];
    if (!returnRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Return request not found' });
    }
    if (returnRow.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This return has already been resolved' });
    }

    await client.query(
      `UPDATE returns SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE return_id = $2`,
      [decision, id]
    );

    if (decision === 'approved') {
      await client.query(
        `UPDATE orders SET status = 'returned', payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
        [returnRow.order_id]
      );

      const itemsRes = await client.query(
        'SELECT book_id, quantity FROM order_items WHERE order_id = $1',
        [returnRow.order_id]
      );
      for (const item of itemsRes.rows) {
        await client.query(
          'UPDATE books SET stock_quantity = stock_quantity + $1 WHERE book_id = $2',
          [item.quantity, item.book_id]
        );
      }
    }

    await client.query(
      `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'return')`,
      [
        returnRow.customer_id,
        decision === 'approved'
          ? `Your return for Order #${returnRow.order_id} was approved. A refund has been issued.`
          : `Your return request for Order #${returnRow.order_id} was rejected.`
      ]
    );

    await client.query('COMMIT');
    res.json({ message: `Return ${decision}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error resolving return:', err.message);
    res.status(500).json({ error: 'Failed to resolve return' });
  } finally {
    client.release();
  }
});

module.exports = router;