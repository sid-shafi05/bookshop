const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireDeliveryman } = require('../middleware/auth');

router.use(verifyToken, requireDeliveryman);

// profile
router.get('/me', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.deliveryman_id, d.user_id, d.name, d.phone, d.vehicle_type, d.is_active,
              u.username, u.email
       FROM deliverymen d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.user_id = $1`,
      [req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Deliveryman profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching deliveryman profile:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// requests awaiting accept/decline
router.get('/requests', async (req, res) => {
  try {
    const me = await pool.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1', [req.userId]);
    if (!me.rows.length) return res.json([]);

    const deliveryman_id = me.rows[0].deliveryman_id;
    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.status AS delivery_status,
              o.total_amount, o.shipping_house_no, o.shipping_street, o.shipping_city, o.shipping_postal_code, o.shipping_country,
              u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1 AND d.status = 'pending_acceptance'
       ORDER BY d.created_at DESC`,
      [deliveryman_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery requests:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/deliveries/:deliveryId/accept', async (req, res) => {
  const { deliveryId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const me = await client.query('SELECT deliveryman_id, name FROM deliverymen WHERE user_id = $1 FOR UPDATE', [req.userId]);
    if (!me.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deliveryman profile not found' });
    }
    const deliveryman_id = me.rows[0].deliveryman_id;

    const dRes = await client.query(
      `SELECT * FROM deliveries WHERE delivery_id = $1 FOR UPDATE`,
      [deliveryId]
    );
    const delivery = dRes.rows[0];
    if (!delivery) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Delivery not found' });
    }
    if (Number(delivery.deliveryman_id) !== Number(deliveryman_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    if (delivery.status !== 'pending_acceptance') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request is no longer pending' });
    }

    await client.query(
      `UPDATE deliveries SET status = 'picked_up', updated_at = CURRENT_TIMESTAMP WHERE delivery_id = $1`,
      [deliveryId]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic)
       SELECT admin_id, $1, 'delivery'
       FROM admins`,
      [`Deliveryman accepted Order #${delivery.order_id}.`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Delivery accepted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting delivery:', err.message);
    res.status(500).json({ error: 'Failed to accept delivery' });
  } finally {
    client.release();
  }
});

router.post('/deliveries/:deliveryId/decline', async (req, res) => {
  const { deliveryId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const me = await client.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1 FOR UPDATE', [req.userId]);
    if (!me.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deliveryman profile not found' });
    }
    const deliveryman_id = me.rows[0].deliveryman_id;

    const dRes = await client.query(
      `SELECT * FROM deliveries WHERE delivery_id = $1 FOR UPDATE`,
      [deliveryId]
    );
    const delivery = dRes.rows[0];
    if (!delivery) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Delivery not found' });
    }
    if (Number(delivery.deliveryman_id) !== Number(deliveryman_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    await client.query(
      `UPDATE deliveries SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE delivery_id = $1`,
      [deliveryId]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic)
       SELECT admin_id, $1, 'delivery'
       FROM admins`,
      [`Deliveryman declined Order #${delivery.order_id}. Please reassign.`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Delivery declined' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error declining delivery:', err.message);
    res.status(500).json({ error: 'Failed to decline delivery' });
  } finally {
    client.release();
  }
});

// active deliveries
router.get('/deliveries', async (req, res) => {
  try {
    const me = await pool.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1', [req.userId]);
    if (!me.rows.length) return res.json([]);
    const deliveryman_id = me.rows[0].deliveryman_id;

    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.status AS delivery_status,
              o.total_amount, o.shipping_house_no, o.shipping_street, o.shipping_city, o.shipping_postal_code, o.shipping_country,
              u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1
         AND d.status IN ('picked_up', 'in_transit', 'out_for_delivery')
       ORDER BY d.created_at DESC`,
      [deliveryman_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active deliveries:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/deliveries/:deliveryId/status', async (req, res) => {
  const { deliveryId } = req.params;
  const { status } = req.body;
  const VALID = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];

  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid delivery status' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const me = await client.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1 FOR UPDATE', [req.userId]);
    if (!me.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deliveryman profile not found' });
    }

    const deliveryman_id = me.rows[0].deliveryman_id;
    const dRes = await client.query('SELECT * FROM deliveries WHERE delivery_id = $1 FOR UPDATE', [deliveryId]);
    const delivery = dRes.rows[0];
    if (!delivery) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Delivery not found' });
    }
    if (Number(delivery.deliveryman_id) !== Number(deliveryman_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    const isDelivered = status === 'delivered';
    await client.query(
      `UPDATE deliveries
       SET status = $1, delivery_date = ${isDelivered ? 'CURRENT_TIMESTAMP' : 'delivery_date'}, updated_at = CURRENT_TIMESTAMP
       WHERE delivery_id = $2`,
      [status, deliveryId]
    );

    if (isDelivered) {
      const updOrder = await client.query(
        `UPDATE orders
         SET status = 'delivered',
             payment_status = CASE WHEN payment_method = 'cash_on_delivery' THEN 'paid' ELSE payment_status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
         RETURNING *`,
        [delivery.order_id]
      );

      if (updOrder.rows[0]) {
        await client.query(
          `INSERT INTO notifications (user_id, text, topic)
           VALUES ($1, $2, 'order')`,
          [updOrder.rows[0].customer_id, `Order #${updOrder.rows[0].order_id} delivered. You can now leave a review.`]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Delivery status updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating my delivery status:', err.message);
    res.status(500).json({ error: 'Failed to update delivery status' });
  } finally {
    client.release();
  }
});

router.get('/deliveries/history', async (req, res) => {
  try {
    const me = await pool.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1', [req.userId]);
    if (!me.rows.length) return res.json([]);

    const deliveryman_id = me.rows[0].deliveryman_id;
    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.status AS delivery_status, o.total_amount, u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1
         AND d.status IN ('delivered', 'failed')
       ORDER BY d.updated_at DESC`,
      [deliveryman_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery history:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/deliveries/:deliveryId', async (req, res) => {
  const { deliveryId } = req.params;
  try {
    const me = await pool.query('SELECT deliveryman_id FROM deliverymen WHERE user_id = $1', [req.userId]);
    if (!me.rows.length) return res.status(404).json({ error: 'Deliveryman profile not found' });

    const deliveryman_id = me.rows[0].deliveryman_id;
    const deliveryRes = await pool.query(
      `SELECT d.*, o.total_amount, o.payment_method, o.payment_status, o.customer_id,
              o.shipping_house_no, o.shipping_street, o.shipping_city, o.shipping_postal_code, o.shipping_country,
              u.username AS customer_name, u.email AS customer_email
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.delivery_id = $1`,
      [deliveryId]
    );

    const delivery = deliveryRes.rows[0];
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (Number(delivery.deliveryman_id) !== Number(deliveryman_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const itemsRes = await pool.query(
      `SELECT oi.order_item_id, oi.book_id, oi.quantity, oi.unit_price, b.title
       FROM order_items oi
       JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_id = $1
       ORDER BY oi.order_item_id ASC`,
      [delivery.order_id]
    );

    res.json({ delivery, items: itemsRes.rows });
  } catch (err) {
    console.error('Error fetching delivery detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;