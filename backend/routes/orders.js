// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// ------------------------------------------------------------------
// Helper: read the customer's current cart (same shape as cart.js)
// ------------------------------------------------------------------
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

// ====================================================================
// POST /orders/checkout -> turns the cart into a 'pending' order
// Body: { customer_id, payment_method, coupon_code?,
//         shipping_house_no?, shipping_street, shipping_city,
//         shipping_postal_code?, shipping_country }
// ====================================================================
router.post('/checkout', async (req, res) => {
  const {
    customer_id, payment_method, coupon_code,
    shipping_house_no, shipping_street, shipping_city,
    shipping_postal_code, shipping_country
  } = req.body;

  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  if (!shipping_street || !shipping_city || !shipping_country) {
    return res.status(400).json({ error: 'Shipping address is incomplete' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cartItems = await getCartItems(client, customer_id);
    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    // Verify stock for every line before touching anything
    for (const item of cartItems) {
      if (item.quantity > item.stock_quantity) {
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
       VALUES ($1,$2,$3,'pending','unpaid',$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [customer_id, coupon ? coupon.coupon_id : null, total.toFixed(2), payment_method || null,
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

    await client.query(
      `DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1)`,
      [customer_id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
      [customer_id, `Order #${order.order_id} placed — total Tk ${total.toFixed(2)}. Please complete payment.`]
    );

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
// POST /orders/:id/pay -> mock payment gateway, always succeeds
// ====================================================================
router.post('/:id/pay', async (req, res) => {
  const { id } = req.params;
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'This order was cancelled' });
    if (order.payment_status === 'paid') return res.status(400).json({ error: 'Order is already paid' });

    const result = await pool.query(
      `UPDATE orders
       SET payment_status = 'paid', status = 'confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1 RETURNING *`,
      [id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
      [order.customer_id, `Payment received for Order #${order.order_id}. We're preparing it now.`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// ====================================================================
// GET /orders/customer/:customer_id -> order history list
// ====================================================================
router.get('/customer/:customer_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id)::int AS item_count,
        d.status AS delivery_status, d.tracking_number
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.order_id
       WHERE o.customer_id = $1
       ORDER BY o.order_date DESC`,
      [req.params.customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customer orders:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// GET /orders/:id -> full order detail (items, delivery, review flags)
// ====================================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
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

    res.json({
      order,
      items: itemsRes.rows,
      delivery: deliveryRes.rows[0] || null,
      can_review: order.status === 'delivered'
    });
  } catch (err) {
    console.error('Error fetching order detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// PUT /orders/:id/cancel -> customer-initiated cancellation
// Only allowed before the order has started being prepared/shipped
// ====================================================================
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
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

// ====================================================================
// PUT /orders/:id/receive -> customer confirms they got the order.
// Only allowed once the admin has shipped it. Marks both the order
// and its delivery record as 'delivered', which unlocks reviews.
// ====================================================================
router.put('/:id/receive', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [id]);
    const order = orderRes.rows[0];
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
    if (order.status !== 'shipped') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Order must be shipped before it can be marked as received (current status: "${order.status}")` });
    }

    await client.query(
      `UPDATE deliveries SET status = 'delivered', delivery_date = CURRENT_TIMESTAMP WHERE order_id = $1`,
      [id]
    );
    const updOrder = await client.query(
      `UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
      [id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
      [order.customer_id, `Thanks for confirming Order #${id} arrived! We'd love to hear your thoughts — leave a review.`]
    );

    await client.query('COMMIT');
    res.json(updOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Receive order error:', err.message);
    res.status(500).json({ error: 'Failed to confirm receipt' });
  } finally {
    client.release();
  }
});

module.exports = router;