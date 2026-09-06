// backend/routes/deliveryman.routes.js
//
// Self-service endpoints for a logged-in deliveryman (the rider himself).
// Mount alongside your other route files, in index.js:
//   app.use('/deliveryman', require('./routes/deliveryman.routes'));
//
// ============================================================================
// ONE REQUIRED SCHEMA CHANGE
// ============================================================================
// Deliverymen now need a login, so they need to be linked to a `users` row:
//
//   ALTER TABLE deliverymen ADD COLUMN user_id INTEGER UNIQUE REFERENCES users(user_id);
//
// (admin.routes.js's POST /deliverymen is updated separately to create that
// users row and fill this column in.)
//
// If your `deliveries.status` column has a CHECK constraint restricting
// which strings are allowed, add 'pending_acceptance' and 'declined' to it.
// If it's a plain VARCHAR/TEXT with no constraint (as the rest of this file
// assumes, matching admin.routes.js), you don't need to touch anything.
//
// ============================================================================
// STATUS LIFECYCLE (deliveries.status)
// ============================================================================
//   pending_acceptance  -- admin just assigned it (see ship endpoint patch),
//                          rider hasn't responded yet
//   preparing           -- rider accepted, getting the order ready
//   picked_up
//   in_transit
//   out_for_delivery
//   delivered           -- terminal; also marks the order delivered
//   failed              -- terminal
//   declined            -- terminal for this rider; deliveryman_id is
//                          cleared and the order goes back to 'processing'
//                          so admin can reassign it
//
// ============================================================================
// AUTH ASSUMPTION
// ============================================================================
// I don't have middleware/auth.js in front of me. This assumes verifyToken
// attaches `req.user` with a `user_id` and `role` field — the same shape
// requireAdmin relies on in admin.routes.js. If your JWT payload names the
// id field differently (e.g. req.user.id), fix the two spots marked below.

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken, (req, res, next) => {
  if (req.user?.role !== 'deliveryman') {
    return res.status(403).json({ error: 'Deliveryman access required' });
  }
  next();
});

// Resolve the deliveryman row tied to the logged-in user, once per request.
async function getRider(userId) {
  const { rows } = await pool.query(
    'SELECT deliveryman_id, name, phone, vehicle_type, is_active FROM deliverymen WHERE user_id = $1',
    [userId] // <-- adjust if your JWT payload names this field differently, e.g. req.user.id
  );
  return rows[0] || null;
}

// GET /deliveryman/me
router.get('/me', async (req, res) => {
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });
    res.json(rider);
  } catch (err) {
    console.error('Error fetching deliveryman profile:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /deliveryman/requests -> assigned, awaiting accept/decline
router.get('/requests', async (req, res) => {
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });

    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.shipping_method, d.tracking_number,
              d.status AS delivery_status,
              d.delivery_house_no AS shipping_house_no, d.delivery_street AS shipping_street,
              d.delivery_city AS shipping_city, d.delivery_country AS shipping_country,
              o.total_amount, o.payment_method, o.payment_status,
              u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1 AND d.status = 'pending_acceptance'
       ORDER BY d.delivery_id ASC`,
      [rider.deliveryman_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery requests:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /deliveryman/deliveries -> accepted, still in progress
router.get('/deliveries', async (req, res) => {
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });

    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.shipping_method, d.tracking_number,
              d.status AS delivery_status,
              d.delivery_house_no AS shipping_house_no, d.delivery_street AS shipping_street,
              d.delivery_city AS shipping_city, d.delivery_country AS shipping_country,
              o.total_amount, o.payment_method, o.payment_status,
              u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1
         AND d.status IN ('preparing', 'picked_up', 'in_transit', 'out_for_delivery')
       ORDER BY d.delivery_id ASC`,
      [rider.deliveryman_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active deliveries:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /deliveryman/deliveries/history -> delivered / failed / declined
router.get('/deliveries/history', async (req, res) => {
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });

    const result = await pool.query(
      `SELECT d.delivery_id, d.order_id, d.tracking_number, d.status AS delivery_status,
              o.total_amount, u.username AS customer_name
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.deliveryman_id = $1 AND d.status IN ('delivered', 'failed')
       ORDER BY d.delivery_id DESC
       LIMIT 100`,
      [rider.deliveryman_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery history:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /deliveryman/deliveries/:id -> full detail (items + customer + address)
router.get('/deliveries/:id', async (req, res) => {
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });

    const deliveryRes = await pool.query(
      `SELECT d.*, d.status AS delivery_status,
              d.delivery_house_no AS shipping_house_no, d.delivery_street AS shipping_street,
              d.delivery_city AS shipping_city, d.delivery_country AS shipping_country,
              o.total_amount, o.payment_method, o.payment_status,
              u.username AS customer_name, u.email AS customer_email
       FROM deliveries d
       JOIN orders o ON o.order_id = d.order_id
       JOIN users u ON u.user_id = o.customer_id
       WHERE d.delivery_id = $1 AND d.deliveryman_id = $2`,
      [req.params.id, rider.deliveryman_id]
    );
    const delivery = deliveryRes.rows[0];
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const itemsRes = await pool.query(
      `SELECT oi.order_item_id, oi.quantity, oi.unit_price, b.title
       FROM order_items oi JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_id = $1 ORDER BY oi.order_item_id ASC`,
      [delivery.order_id]
    );

    res.json({ delivery, items: itemsRes.rows });
  } catch (err) {
    console.error('Error fetching delivery detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /deliveryman/deliveries/:id/accept
router.post('/deliveries/:id/accept', async (req, res) => {
  const { id } = req.params;
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) return res.status(404).json({ error: 'No deliveryman profile linked to this account.' });
    if (!rider.is_active) return res.status(403).json({ error: 'Your account is inactive. Contact the admin.' });

    const result = await pool.query(
      `UPDATE deliveries SET status = 'preparing'
       WHERE delivery_id = $1 AND deliveryman_id = $2 AND status = 'pending_acceptance'
       RETURNING *`,
      [id, rider.deliveryman_id]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'This request is no longer available.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error accepting delivery:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /deliveryman/deliveries/:id/decline
router.post('/deliveries/:id/decline', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) { client.release(); return res.status(404).json({ error: 'No deliveryman profile linked to this account.' }); }

    await client.query('BEGIN');
    const deliveryRes = await client.query(
      `UPDATE deliveries SET status = 'declined', deliveryman_id = NULL
       WHERE delivery_id = $1 AND deliveryman_id = $2 AND status = 'pending_acceptance'
       RETURNING *`,
      [id, rider.deliveryman_id]
    );
    const delivery = deliveryRes.rows[0];
    if (!delivery) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This request is no longer available.' });
    }

    // Put the order back where the admin can reassign it
    await client.query(
      `UPDATE orders SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
      [delivery.order_id]
    );
    await client.query('COMMIT');
    res.json(delivery);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error declining delivery:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// PUT /deliveryman/deliveries/:id/status   body: { status }
const NEXT_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
router.put('/deliveries/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!NEXT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${NEXT_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    const rider = await getRider(req.user.user_id);
    if (!rider) { client.release(); return res.status(404).json({ error: 'No deliveryman profile linked to this account.' }); }

    await client.query('BEGIN');
    const deliveryRes = await client.query(
      `SELECT * FROM deliveries WHERE delivery_id = $1 AND deliveryman_id = $2 FOR UPDATE`,
      [id, rider.deliveryman_id]
    );
    const delivery = deliveryRes.rows[0];
    if (!delivery || ['delivered', 'failed', 'declined'].includes(delivery.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Delivery not found or already finished.' });
    }

    const isDelivered = status === 'delivered';
    const updDelivery = await client.query(
      `UPDATE deliveries SET status = $1, delivery_date = ${isDelivered ? 'CURRENT_TIMESTAMP' : 'delivery_date'}
       WHERE delivery_id = $2 RETURNING *`,
      [status, id]
    );

    if (isDelivered) {
      const updOrder = await client.query(
        `UPDATE orders
         SET status = 'delivered',
             payment_status = CASE WHEN payment_method = 'cash_on_delivery' THEN 'paid' ELSE payment_status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1 RETURNING *`,
        [delivery.order_id]
      );
      const order = updOrder.rows[0];
      await client.query(
        `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
        [order.customer_id, `Order #${order.order_id} has been delivered. We'd love to hear what you thought — leave a review!`]
      );
    }

    await client.query('COMMIT');
    res.json(updDelivery.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating delivery status:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

module.exports = router;