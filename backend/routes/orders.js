// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../utils/notify');

router.use(verifyToken);

async function getCartItems(client, customerId) {
  const query = `
    SELECT b.book_id, b.title, b.price, b.stock_quantity, ci.quantity
    FROM carts c
    JOIN cart_items ci ON c.cart_id = ci.cart_id
    JOIN books b ON ci.book_id = b.book_id
    WHERE c.customer_id = $1
    ORDER BY b.book_id ASC;
  `;
  const result = await client.query(query, [customerId]);
  return result.rows;
}
async function verifyOrderOwnership(orderId, userId) {
  const result = await pool.query(
    'SELECT customer_id FROM orders WHERE order_id = $1',
    [orderId]
  );
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].customer_id) === Number(userId)
    ? result.rows[0]
    : false;
}

// ====================================================================
// POST /orders/checkout -> turns the cart into a 'pending' order
// Now also notifies every admin that a new order came in (previously
// only the customer was told anything).
// ====================================================================
router.post('/checkout', async (req, res) => {
  const {
    customer_id, payment_method, coupon_code,
    shipping_house_no, shipping_street, shipping_city,
    shipping_postal_code, shipping_country
  } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

  if (Number(customer_id) !== Number(req.userId)) {
    return res.status(403).json({ error: 'Access denied: cannot checkout for another user' });
  }

  const allowedPaymentMethods = ['cash_on_delivery', 'mock_online'];
  if (!allowedPaymentMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  if (!shipping_street || !shipping_city || !shipping_country) {
    return res.status(400).json({ error: 'Shipping address is incomplete' });
  }
  const paymentStatus = payment_method === 'cash_on_delivery' ? 'unpaid' : 'paid';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cartItems = await getCartItems(client, customer_id);
    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    // Stock validation now handled by DB trigger trg_validate_stock_order

    const subtotal = cartItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    let discount = 0;
    let coupon = null;

    if (coupon_code) {
      const couponRes = await client.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND is_active = TRUE
           AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
           FOR UPDATE `,
        [coupon_code]
      );
      coupon = couponRes.rows[0];
      if (!coupon) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid or expired coupon code' });
      }
      if (subtotal < Number(coupon.min_order_amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `This coupon requires a minimum order of Tk ${coupon.min_order_amount}` });
      }
      discount = subtotal * (Number(coupon.discount_percent) / 100);
      if (coupon.max_discount) discount = Math.min(discount, Number(coupon.max_discount));
    }

    const total = Math.max(subtotal - discount, 0);

    const orderRes = await client.query(
      `INSERT INTO orders
        (customer_id, coupon_id, total_amount, status, payment_status, payment_method,
         shipping_house_no, shipping_street, shipping_city, shipping_postal_code, shipping_country)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [customer_id, coupon ? coupon.coupon_id : null, total.toFixed(2), paymentStatus, payment_method || null,
        shipping_house_no || null, shipping_street, shipping_city, shipping_postal_code || null, shipping_country]
    );
    const order = orderRes.rows[0];

    for (const item of cartItems) {
      await client.query(
        `INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [order.order_id, item.book_id, item.quantity, item.price]
      );
      await client.query(
        `UPDATE books SET stock_quantity = stock_quantity - $1 WHERE book_id = $2`,
        [item.quantity, item.book_id]
      );
    }
    if (coupon) {
  await client.query(
    `UPDATE coupons SET times_used = times_used + 1 WHERE coupon_id = $1`,
    [coupon.coupon_id]
  );
}

    await client.query(
      `DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1)`,
      [customer_id]
    );

    const notification =
      payment_method === 'cash_on_delivery'
        ? `Order #${order.order_id} placed successfully. Payment will be collected upon delivery.`
        : `Order #${order.order_id} placed successfully. Simulated online payment recorded.`;

    await notify({
      userId: customer_id,
      text: notification,
      topic: 'order',
      referenceType: 'order',
      referenceId: order.order_id,
      client,
    });

    // NEW: tell admins a new order needs attention.
    await notifyAdmins({
      text: `New order #${order.order_id} placed (Tk ${total.toFixed(2)}, ${payment_method}). Review and confirm it.`,
      topic: 'order',
      referenceType: 'order',
      referenceId: order.order_id,
      client,
    });

    await client.query('COMMIT');
    res.status(201).json({ order, subtotal: subtotal.toFixed(2), discount: discount.toFixed(2), total: total.toFixed(2) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message?.includes('Insufficient stock')) {
      return res.status(400).json({ error: 'Some items are no longer available in the requested quantity. Please review your cart.' });
    }
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
  }
});

// ====================================================================
// GET /orders/customer/:customer_id -> order history list (unchanged)
// ====================================================================
router.get('/customer/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  if (Number(customer_id) !== Number(req.userId)) {
    return res.status(403).json({ error: 'Access denied: cannot view another user\'s orders' });
  }
  try {
    const result = await pool.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id)::int AS item_count,
        d.status AS delivery_status, d.tracking_number
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.order_id
       WHERE o.customer_id = $1
       ORDER BY o.order_date DESC`,
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customer orders:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/return', async (req, res) => {
  const { id } = req.params;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const requestedItemIds = Array.isArray(req.body.item_ids)
    ? [...new Set(req.body.item_ids.map(Number).filter(Number.isInteger))]
    : null;
  if (!reason) return res.status(400).json({ error: 'A return reason is required' });

  const ownership = await verifyOrderOwnership(id, req.userId);
  if (ownership === null) return res.status(404).json({ error: 'Order not found' });
  if (ownership === false) return res.status(403).json({ error: 'Access denied: not your order' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      'SELECT status FROM orders WHERE order_id = $1 FOR UPDATE',
      [id]
    );
    if (orderRes.rows[0]?.status !== 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only delivered orders can be returned' });
    }

    const deliveryRes = await client.query(
      'SELECT delivery_date FROM deliveries WHERE order_id = $1 ORDER BY delivery_id DESC LIMIT 1',
      [id]
    );
    const deliveryDate = deliveryRes.rows[0]?.delivery_date;
    if (!deliveryDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order does not have a delivery date yet' });
    }
    if (Date.now() - new Date(deliveryDate).getTime() > 10 * 24 * 60 * 60 * 1000) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The 10-day return window for this order has expired' });
    }

    const existingRes = await client.query(
      'SELECT return_id FROM returns WHERE order_id = $1 LIMIT 1',
      [id]
    );
    if (existingRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A return request has already been submitted for this order' });
    }

    const itemsRes = await client.query(
      'SELECT order_item_id FROM order_items WHERE order_id = $1 ORDER BY order_item_id',
      [id]
    );
    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order has no items to return' });
    }

    const orderItemIds = new Set(itemsRes.rows.map((row) => Number(row.order_item_id)));
    const selectedItemIds = requestedItemIds || [...orderItemIds];

    if (selectedItemIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Select at least one item to return' });
    }
    if (selectedItemIds.some((itemId) => !orderItemIds.has(itemId))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more selected items do not belong to this order' });
    }
    const created = [];
    for (const itemId of selectedItemIds) {
      const result = await client.query(
        `INSERT INTO returns (order_id, order_item_id, customer_id, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING return_id, order_id, order_item_id, reason, status, requested_at`,
        [id, itemId, req.userId, reason]
      );
      created.push(result.rows[0]);
    }

    await notifyAdmins({
      text: `Return requested for Order #${id}.`,
      topic: 'order',
      referenceType: 'order',
      referenceId: id,
      client,
    });

    await client.query('COMMIT');
    res.status(201).json(created[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return request error:', err.message);
    res.status(500).json({ error: 'Failed to submit return request' });
  } finally {
    client.release();
  }
});

// ====================================================================
// GET /orders/:id -> full order detail (unchanged)
// ====================================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const ownership = await verifyOrderOwnership(id, req.userId);
    if (ownership === null) return res.status(404).json({ error: 'Order not found' });
    if (ownership === false) return res.status(403).json({ error: 'Access denied: not your order' });

    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await pool.query(
      `SELECT oi.order_item_id, oi.book_id, oi.quantity, oi.unit_price, b.title, b.cover_url,
        EXISTS(SELECT 1 FROM reviews r WHERE r.book_id = oi.book_id AND r.customer_id = $2) AS already_reviewed,
        EXISTS(SELECT 1 FROM returns r WHERE r.order_item_id = oi.order_item_id AND r.status <> 'rejected') AS return_requested
       FROM order_items oi
       JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_id = $1
       ORDER BY oi.order_item_id ASC`,
      [id, order.customer_id]
    );

    const deliveryRes = await pool.query(
      `SELECT d.*, dm.name AS deliveryman_name, dm.phone AS deliveryman_phone
       FROM deliveries d
       LEFT JOIN deliverymen dm ON dm.deliveryman_id = d.deliveryman_id
       WHERE d.order_id = $1`,
      [id]
    );

    const returnsRes = await pool.query(
      `SELECT return_id, order_item_id, reason, status, requested_at, resolved_at
       FROM returns
       WHERE order_id = $1
       ORDER BY requested_at DESC`,
      [id]
    );
    const latestReturn = returnsRes.rows[0] || null;
    const deliveryDate = deliveryRes.rows[0]?.delivery_date;
    const withinReturnWindow = deliveryDate
      && Date.now() - new Date(deliveryDate).getTime() <= 10 * 24 * 60 * 60 * 1000;
    const canReturn = order.status === 'delivered'
      && withinReturnWindow
      && returnsRes.rows.length === 0;

    res.json({
      order,
      items: itemsRes.rows,
      delivery: deliveryRes.rows[0] || null,
      can_review: order.status === 'delivered',
      can_return: canReturn,
      return_window_expired: order.status === 'delivered' && !withinReturnWindow,
      return_window_days: 10,
      return_request: latestReturn
    });
  } catch (err) {
    console.error('Error fetching order detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// PUT /orders/:id/cancel -> customer-initiated cancellation
// Now uses proc_cancel_order procedure
// ====================================================================
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const ownership = await verifyOrderOwnership(id, req.userId);
  if (ownership === null) return res.status(404).json({ error: 'Order not found' });
  if (ownership === false) return res.status(403).json({ error: 'You cannot cancel another user\'s order' });

  try {
    await pool.query('CALL proc_cancel_order($1, $2)', [id, req.userId]);
    res.json({ message: 'Order cancelled successfully' });
  } catch (err) {
    if (err.message.includes('Order not found')) return res.status(404).json({ error: 'Order not found' });
    if (err.message.includes('Access denied')) return res.status(403).json({ error: 'You cannot cancel another user\'s order' });
    if (err.message.includes('can no longer be cancelled')) return res.status(400).json({ error: 'This order can no longer be cancelled' });
    console.error('Cancel order error:', err.message);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;