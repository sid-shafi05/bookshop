// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../utils/notify');
const { hasActiveOrderReturn } = require('../utils/returnState');

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

    // Check if order is eligible for returns (delivered within 10 days)
    let canReturn = false;
    if (order.status === 'delivered') {
      const delivery = deliveryRes.rows[0];
      if (delivery && delivery.delivery_date) {
        const daysSinceDelivery = (Date.now() - new Date(delivery.delivery_date).getTime()) / (1000 * 60 * 60 * 24);
        canReturn = daysSinceDelivery <= 10;
      }
    }

    // Get return requests for this order
    const returnsRes = await pool.query(
      `SELECT r.return_id, r.order_item_id, r.reason, r.status, r.refund_amount, r.condition, r.requested_at, r.resolved_at
       FROM returns r
       WHERE r.order_id = $1
       ORDER BY r.requested_at DESC`,
      [id]
    );
    const activeOrderReturn = hasActiveOrderReturn(returnsRes.rows);
    const canReturnRequest = order.status === 'delivered' && !activeOrderReturn && canReturn;

    res.json({
      order,
      items: itemsRes.rows,
      delivery: deliveryRes.rows[0] || null,
      can_review: order.status === 'delivered',
      can_return: canReturnRequest,
      return_requests: returnsRes.rows
    });
  } catch (err) {
    console.error('Error fetching order detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// POST /orders/:id/return -> customer requests return for items in a delivered order
// Body: { order_item_ids: [int], reason: string }
// ====================================================================
router.post('/:id/return', async (req, res) => {
  const { id } = req.params;
  const { order_item_ids, reason } = req.body;

  if (!Array.isArray(order_item_ids) || order_item_ids.length === 0) {
    return res.status(400).json({ error: 'At least one item must be selected for return' });
  }
  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (!reasonText) {
    return res.status(400).json({ error: 'A return reason is required' });
  }

  const ownership = await verifyOrderOwnership(id, req.userId);
  if (ownership === null) return res.status(404).json({ error: 'Order not found' });
  if (ownership === false) return res.status(403).json({ error: 'Access denied: not your order' });

  const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'delivered') {
    return res.status(400).json({ error: 'Returns are only allowed for delivered orders' });
  }

  // Check 10-day return window from delivery date
  const deliveryRes = await pool.query(
    'SELECT delivery_date FROM deliveries WHERE order_id = $1 AND status = $2',
    [id, 'delivered']
  );
  const delivery = deliveryRes.rows[0];
  if (!delivery || !delivery.delivery_date) {
    return res.status(400).json({ error: 'Order not yet delivered' });
  }
  const daysSinceDelivery = (Date.now() - new Date(delivery.delivery_date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > 10) {
    return res.status(400).json({ error: 'Return window expired (10 days after delivery)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify all items belong to this order and don't have existing returns
    const itemsRes = await client.query(
      `SELECT oi.order_item_id, oi.book_id, oi.quantity, oi.unit_price, b.title
       FROM order_items oi
       JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_id = $1 AND oi.order_item_id = ANY($2)`,
      [id, order_item_ids]
    );
    if (itemsRes.rows.length !== order_item_ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more items do not belong to this order' });
    }

    // One return request per order only; once a request is active, the order is locked.
    const existingRes = await client.query(
      `SELECT return_id FROM returns WHERE order_id = $1 AND status != 'rejected' LIMIT 1`,
      [id]
    );
    if (existingRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A return request already exists for this order' });
    }

    // Insert return requests (one per item, same reason)
    const returnIds = [];
    for (const item of itemsRes.rows) {
      const refundAmount = Number(item.unit_price) * item.quantity;
      const retRes = await client.query(
        `INSERT INTO returns (order_id, order_item_id, customer_id, reason, status, refund_amount, condition)
         VALUES ($1, $2, $3, $4, 'requested', $5, NULL)
         RETURNING return_id`,
        [id, item.order_item_id, req.userId, reasonText, refundAmount]
      );
      returnIds.push(retRes.rows[0].return_id);
    }

    await notifyAdmins({
      text: `Return request for Order #${id} (${order_item_ids.length} items): ${reasonText}`,
      topic: 'return',
      referenceType: 'order',
      referenceId: Number(id),
      client
    });

    await client.query('COMMIT');
    res.status(201).json({ return_ids: returnIds, message: 'Return request submitted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create return request error:', err.message);
    res.status(500).json({ error: 'Failed to submit return request' });
  } finally {
    client.release();
  }
});

// ====================================================================
// PUT /orders/:id/cancel -> customer-initiated cancellation
// Now also notifies admins so they don't keep prepping/shipping it.
// ====================================================================
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
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
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

    await notifyAdmins({
      text: `Order #${id} was cancelled by the customer.`,
      topic: 'order',
      referenceType: 'order',
      referenceId: Number(id),
      client,
    });

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

module.exports = router;