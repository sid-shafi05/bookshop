const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireCustomer } = require('../middleware/auth');

// customer-only routes
router.use(verifyToken, requireCustomer);

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

    for (const item of cartItems) {
      if (item.quantity > item.stock_quantity || item.quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `"${item.title}" only has ${item.stock_quantity} left in stock` });
      }
    }

    const subtotal = cartItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    let discount = 0;
    let coupon = null;

    if (coupon_code) {
      const couponRes = await client.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND is_active = TRUE
           AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)`,
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
      [
        customer_id,
        coupon ? coupon.coupon_id : null,
        total.toFixed(2),
        paymentStatus,
        payment_method || null,
        shipping_house_no || null,
        shipping_street,
        shipping_city,
        shipping_postal_code || null,
        shipping_country
      ]
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

    await client.query(
      `DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1)`,
      [customer_id]
    );

    const notification =
      payment_method === 'cash_on_delivery'
        ? `Order #${order.order_id} placed successfully. Payment will be collected upon delivery.`
        : `Order #${order.order_id} placed successfully. Simulated online payment recorded.`;

    await client.query(
      `INSERT INTO notifications (user_id, text, topic)
       VALUES ($1, $2, 'order')`,
      [customer_id, notification]
    );

    await client.query('COMMIT');
    res.status(201).json({
      order,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
  }
});

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
        EXISTS(SELECT 1 FROM reviews r WHERE r.book_id = oi.book_id AND r.customer_id = $2) AS already_reviewed
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

    const returnRes = await pool.query('SELECT * FROM returns WHERE order_id = $1', [id]);
    const deliveryRow = deliveryRes.rows[0];

    let canReturn = false;
    if (order.status === 'delivered' && deliveryRow?.delivery_date && returnRes.rows.length === 0) {
      const daysSinceDelivery = (Date.now() - new Date(deliveryRow.delivery_date).getTime()) / (1000 * 60 * 60 * 24);
      canReturn = daysSinceDelivery <= 3;
    }

    res.json({
      order,
      items: itemsRes.rows,
      delivery: deliveryRow || null,
      can_review: order.status === 'delivered',
      can_return: canReturn,
      return_request: returnRes.rows[0] || null
    });
  } catch (err) {
    console.error('Error fetching order detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;

  const ownership = await verifyOrderOwnership(id, req.userId);
  if (ownership === null) return res.status(404).json({ error: 'Order not found' });
  if (ownership === false) return res.status(403).json({ error: 'You cannot cancel another user\'s order' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [id]);
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order can no longer be cancelled — it is already being prepared or shipped' });
    }

    const itemsRes = await client.query('SELECT book_id, quantity FROM order_items WHERE order_id = $1', [id]);
    for (const item of itemsRes.rows) {
      await client.query('UPDATE books SET stock_quantity = stock_quantity + $1 WHERE book_id = $2', [item.quantity, item.book_id]);
    }

    const result = await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
      [id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel order error:', err.message);
    res.status(500).json({ error: 'Failed to cancel order' });
  } finally {
    client.release();
  }
});

router.post('/:id/return', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Please provide a reason for the return' });
  }

  const ownership = await verifyOrderOwnership(id, req.userId);
  if (ownership === null) return res.status(404).json({ error: 'Order not found' });
  if (ownership === false) return res.status(403).json({ error: 'Access denied: not your order' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [id]);
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only delivered orders can be returned' });
    }

    const deliveryRes = await client.query(
      'SELECT delivery_date FROM deliveries WHERE order_id = $1',
      [id]
    );
    const deliveryDate = deliveryRes.rows[0]?.delivery_date;
    if (!deliveryDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Delivery date not found for this order' });
    }

    const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The 3-day return window for this order has passed' });
    }

    const existing = await client.query('SELECT * FROM returns WHERE order_id = $1', [id]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A return has already been requested for this order' });
    }

    const result = await client.query(
      `INSERT INTO returns (order_id, customer_id, reason)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, req.userId, reason.trim()]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic)
       SELECT admin_id, $1, 'return'
       FROM admins`,
      [`Return requested for Order #${id}.`]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return request error:', err.message);
    res.status(500).json({ error: 'Failed to submit return request' });
  } finally {
    client.release();
  }
});

module.exports = router;