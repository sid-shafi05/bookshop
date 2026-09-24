const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, o.total_amount, o.payment_method, u.username, u.email,
              oi.book_id, oi.quantity, oi.unit_price, b.title
       FROM returns r
       JOIN orders o ON o.order_id = r.order_id
       JOIN users u ON u.user_id = r.customer_id
       JOIN order_items oi ON oi.order_item_id = r.order_item_id
       JOIN books b ON b.book_id = oi.book_id
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
  const { decision, condition } = req.body; // decision: 'approved' | 'rejected', condition: 'resellable' | 'damaged'

  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }
  if (decision === 'approved' && !['resellable', 'damaged'].includes(condition)) {
    return res.status(400).json({ error: 'Condition must be resellable or damaged' });
  }

  try {
    if (decision === 'approved') {
      // Process approval via stored procedure
      await pool.query('CALL proc_process_return($1, $2, $3)', [id, condition, req.userId]);
    } else {
      // Reject return request
      await pool.query('UPDATE returns SET status = $1, resolved_at = NOW() WHERE return_id = $2', ['rejected', id]);

      // Fetch details of the rejected return
      const returnRes = await pool.query('SELECT customer_id, order_id FROM returns WHERE return_id = $1', [id]);
      
      if (returnRes.rows[0]) {
        const { customer_id, order_id } = returnRes.rows[0];

        // Check remaining returns status for this order
        const summary = await pool.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status IN ('approved', 'processed'))::int AS approved
           FROM returns WHERE order_id = $1`,
          [order_id]
        );

        const { total, approved } = summary.rows[0];

        if (approved === 0) {
          await pool.query(
            `UPDATE orders SET status = 'delivered', payment_status = 'paid', updated_at = NOW()
             WHERE order_id = $1`,
            [order_id]
          );
        } else if (approved === total) {
          await pool.query(
            `UPDATE orders SET status = 'returned', payment_status = 'refunded', updated_at = NOW()
             WHERE order_id = $1`,
            [order_id]
          );
        } else {
          await pool.query(
            `UPDATE orders SET status = 'partially_returned', payment_status = 'partial_refund', updated_at = NOW()
             WHERE order_id = $1`,
            [order_id]
          );
        }

        // Send rejection notification
        await pool.query(
          `INSERT INTO notifications (user_id, text, topic, reference_type, reference_id)
           VALUES ($1, $2, 'return', 'order', $3)`,
          [customer_id, `Your return request for Order #${order_id} was rejected.`, order_id]
        );
      }
    }

    res.json({ message: `Return ${decision}` });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: 'Return request not found' });
    if (err.message.includes('Already resolved')) return res.status(400).json({ error: 'This return has already been resolved' });
    
    console.error('Error resolving return:', err.message);
    res.status(500).json({ error: 'Failed to resolve return' });
  }
});

module.exports = router;