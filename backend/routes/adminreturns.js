const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../utils/notify');

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const returnRes = await client.query('SELECT * FROM returns WHERE return_id = $1 FOR UPDATE', [id]);
    const returnRow = returnRes.rows[0];
    if (!returnRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Return request not found' });
    }
    if (returnRow.status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This return has already been resolved' });
    }

    // Get item details for refund/stock
    const itemRes = await client.query(
      `SELECT oi.*, b.title 
       FROM order_items oi
       JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_item_id = $1`,
      [returnRow.order_item_id]
    );
    const item = itemRes.rows[0];
    const refundAmount = Number(item.unit_price) * item.quantity;

    if (decision === 'approved') {
      // Update return record with condition
      await client.query(
        `UPDATE returns SET status = 'approved', resolved_at = CURRENT_TIMESTAMP, condition = $1 WHERE return_id = $2`,
        [condition, id]
      );

      // Conditional stock update - only if resellable
      if (condition === 'resellable') {
        await client.query(
          'UPDATE books SET stock_quantity = stock_quantity + $1 WHERE book_id = $2',
          [item.quantity, item.book_id]
        );
      }

      // Check if ALL items in order are now returned
      const allReturnedRes = await client.query(
        `SELECT COUNT(*) as total, 
                COUNT(CASE WHEN r.status IN ('approved','processed') THEN 1 END) as returned
         FROM order_items oi
         LEFT JOIN returns r ON r.order_item_id = oi.order_item_id
         WHERE oi.order_id = $1`,
        [returnRow.order_id]
      );
      
      const allReturned = allReturnedRes.rows[0].total === allReturnedRes.rows[0].returned;

      if (allReturned) {
        // ALL items returned - full refund, while the order remains delivered
        await client.query(
          `UPDATE orders SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
          [returnRow.order_id]
        );
      } else {
        // Partial return - partial refund, order stays delivered
        await client.query(
          `UPDATE orders SET payment_status = 'partial_refund', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
          [returnRow.order_id]
        );
      }
    } else {
      // Rejected
      await client.query(
        `UPDATE returns SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE return_id = $1`,
        [id]
      );
    }

    // Notify customer
    const msg = decision === 'approved'
      ? `Return approved for "${item.title}". ${condition === 'resellable' ? 'Item will be restocked.' : 'Item written off as damaged.'} Tk ${refundAmount.toFixed(2)} refunded.`
      : `Return rejected for "${item.title}".`;

    await client.query(
      `INSERT INTO notifications (user_id, text, topic, reference_type, reference_id)
       VALUES ($1, $2, 'return', 'order', $3)`,
      [returnRow.customer_id, msg, returnRow.order_id]
    );

    await client.query('COMMIT');
    res.json({ message: `Return ${decision}`, refund: refundAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error resolving return:', err.message);
    res.status(500).json({ error: 'Failed to resolve return' });
  } finally {
    client.release();
  }
});

module.exports = router;