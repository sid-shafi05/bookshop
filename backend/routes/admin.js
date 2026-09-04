const express = require('express');
const router= express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes below require a valid admin token
router.use(verifyToken, requireAdmin);

// ====================================================================
// BOOKS
// ====================================================================

// Add a new book (admin only) — now accepts an optional cover_image file
router.post('/books', upload.single('cover_image'), async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const isbn = typeof req.body.isbn === 'string' ? req.body.isbn.trim() || null : null;
  const { price, stock_quantity, publication_year, category_id } = req.body;
  if (!title || !Number.isFinite(Number(price)) || !Number.isInteger(Number(stock_quantity)) || Number(stock_quantity) < 0) {
    return res.status(400).json({ error: 'Title, valid price, and non-negative stock quantity are required' });
  }
  if (publication_year && (!Number.isInteger(Number(publication_year)) || Number(publication_year) < 1000 || Number(publication_year) > 2100)) {
    return res.status(400).json({ error: 'Publication year must be between 1000 and 2100' });
  }

    // req.file only exists if a file was actually uploaded (multer put it there)
    const cover_url = req.file ? `/images/books/${req.file.filename}` : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
            'INSERT INTO books (title, isbn, price, stock_quantity, publication_year, cover_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, isbn, Number(price), Number(stock_quantity), publication_year || null, cover_url]
        );
      const book = result.rows[0];
      if (category_id) {
        await client.query(
          'INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)',
          [book.book_id, category_id]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(book);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        res.status(409).json({ error: 'A book with this ISBN already exists' });
        return;
      }
        console.error('Error adding book:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    } finally {
      client.release();
    }
});

router.get('/books', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*,
              COALESCE(
                (SELECT array_agg(c.category_name ORDER BY c.category_name)
                 FROM book_categories bc
                 JOIN categories c ON c.category_id = bc.category_id
                 WHERE bc.book_id = b.book_id),
                '{}'
              ) AS categories
            FROM books b
            ORDER BY b.book_id ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching books:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a book — now accepts an optional new cover_image file
router.put('/books/:id', upload.single('cover_image'), async (req, res) => {
    const { id } = req.params;
    const { title, isbn, price, stock_quantity, publication_year, existing_cover_url, category_id } = req.body;

    const cover_url = req.file ? `/images/books/${req.file.filename}` : (existing_cover_url || null);

    try {
        const result = await pool.query(
            'UPDATE books SET title = $1, isbn = $2, price = $3, stock_quantity = $4, publication_year = $5, cover_url = $6 WHERE book_id = $7 RETURNING *',
            [title, isbn, price, stock_quantity, publication_year, cover_url, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        await pool.query('DELETE FROM book_categories WHERE book_id = $1', [id]);
        if (category_id) {
          await pool.query(
            'INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)',
            [id, category_id]
          );
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating book:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category_id, category_name FROM categories ORDER BY category_name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin categories:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/books/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM books WHERE book_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.status(200).json({ message: 'Book deleted successfully' });
    }   catch (err) {
        console.error('Error deleting book:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ====================================================================
// USERS (read-only)
// ====================================================================

// Create another admin. Every existing admin is allowed to use this endpoint.
router.post('/admins', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
    if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING user_id, username, email, role, created_at`,
      [username.trim(), email.trim().toLowerCase(), passwordHash]
    );
    const admin = userResult.rows[0];
    await client.query('INSERT INTO admins (admin_id) VALUES ($1)', [admin.user_id]);
    await client.query('COMMIT');
    res.status(201).json(admin);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('Error creating admin:', err.message);
    res.status(500).json({ error: 'Failed to create admin' });
  } finally {
    client.release();
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, email, role, phone, city, country, created_at FROM users ORDER BY user_id ASC'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// ORDERS
// ====================================================================

// GET all orders with customer info + delivery snapshot
router.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.order_id, o.status, o.payment_status, o.total_amount, o.order_date, o.payment_method,
             u.username, u.email,
             d.delivery_id, d.status AS delivery_status, d.tracking_number,
             d.rider_name, d.rider_phone
      FROM orders o
      JOIN users u ON u.user_id = o.customer_id
      LEFT JOIN deliveries d ON d.order_id = o.order_id
      ORDER BY o.order_date DESC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/order-details/:id', async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT o.*, u.username, u.email
       FROM orders o JOIN users u ON u.user_id = o.customer_id
       WHERE o.order_id = $1`,
      [req.params.id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const itemsResult = await pool.query(
      `SELECT oi.order_item_id, oi.book_id, oi.quantity, oi.unit_price, b.title, b.cover_url
       FROM order_items oi JOIN books b ON b.book_id = oi.book_id
       WHERE oi.order_id = $1 ORDER BY oi.order_item_id ASC`,
      [req.params.id]
    );
    const deliveryResult = await pool.query(
      `SELECT d.*, dm.name AS deliveryman_name, dm.phone AS deliveryman_phone
       FROM deliveries d LEFT JOIN deliverymen dm ON dm.deliveryman_id = d.deliveryman_id
       WHERE d.order_id = $1`,
      [req.params.id]
    );
    res.json({ order: orderResult.rows[0], items: itemsResult.rows, delivery: deliveryResult.rows[0] || null });
  } catch (err) {
    console.error('Error fetching admin order detail:', err.message);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// PUT update order status — manual override, kept for flexibility.
// The normal path for shipped/delivered is via /orders/:id/ship and
// /deliveries/:delivery_id/status below, which keep the delivery row in sync.
router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  if (['shipped', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Use the Assign Delivery / delivery status actions to move an order to shipped or delivered' });
  }

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /admin/orders/:id/ship -> assign a deliveryman, create/refresh the
// delivery record, and move the order to 'shipped'
// Body: { deliveryman_id, shipping_method?, tracking_number? }
router.post('/orders/:id/ship', async (req, res) => {
  const { id } = req.params;
  const { deliveryman_id, shipping_method, tracking_number } = req.body;

  if (!deliveryman_id) return res.status(400).json({ error: 'deliveryman_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [id]);
    const order = orderRes.rows[0];
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
    if (order.payment_status !== 'paid' && order.payment_method !== 'cash_on_delivery') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order has not been paid for yet' });
    }
    if (!['confirmed', 'processing'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot assign delivery from status "${order.status}"` });
    }

    const riderRes = await client.query('SELECT * FROM deliverymen WHERE deliveryman_id = $1', [deliveryman_id]);
    const rider = riderRes.rows[0];
    if (!rider) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Deliveryman not found' }); }

    // One delivery row per order — create it if this is the first assignment,
    // otherwise re-assign (e.g. swapping riders) while keeping the same tracking number
    const existingRes = await client.query('SELECT * FROM deliveries WHERE order_id = $1', [id]);
    let delivery;
    if (existingRes.rows.length > 0) {
      const upd = await client.query(
        `UPDATE deliveries
         SET deliveryman_id = $1, rider_name = $2, rider_phone = $3,
             shipping_method = COALESCE($4, shipping_method),
             tracking_number = COALESCE($5, tracking_number),
             status = 'picked_up',
             delivery_house_no = $6, delivery_street = $7, delivery_city = $8,
             delivery_postal_code = $9, delivery_country = $10
         WHERE order_id = $11 RETURNING *`,
        [deliveryman_id, rider.name, rider.phone, shipping_method || null, tracking_number || null,
          order.shipping_house_no, order.shipping_street, order.shipping_city, order.shipping_postal_code, order.shipping_country, id]
      );
      delivery = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO deliveries
          (order_id, deliveryman_id, rider_name, rider_phone, shipping_method, tracking_number, status,
           delivery_house_no, delivery_street, delivery_city, delivery_postal_code, delivery_country)
         VALUES ($1,$2,$3,$4,$5,$6,'picked_up',$7,$8,$9,$10,$11) RETURNING *`,
        [id, deliveryman_id, rider.name, rider.phone, shipping_method || null,
          tracking_number || `TRK-${id}-${Date.now().toString().slice(-6)}`,
          order.shipping_house_no, order.shipping_street, order.shipping_city, order.shipping_postal_code, order.shipping_country]
      );
      delivery = ins.rows[0];
    }

    const orderUpd = await client.query(
      `UPDATE orders SET status = 'shipped', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
      [id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
      [order.customer_id, `Order #${id} is on its way with ${rider.name} (${rider.phone}).`]
    );

    await client.query('COMMIT');
    res.json({ order: orderUpd.rows[0], delivery });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning delivery:', err.message);
    res.status(500).json({ error: 'Failed to assign delivery' });
  } finally {
    client.release();
  }
});

// PUT /admin/deliveries/:delivery_id/status -> advance the delivery's
// progress. Marking it 'delivered' also marks the parent order delivered.
router.put('/deliveries/:delivery_id/status', async (req, res) => {
  const { delivery_id } = req.params;
  const { status } = req.body;
  const VALID = ['preparing','picked_up','in_transit','out_for_delivery','delivered','failed'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid delivery status' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deliveryRes = await client.query('SELECT * FROM deliveries WHERE delivery_id = $1 FOR UPDATE', [delivery_id]);
    const delivery = deliveryRes.rows[0];
    if (!delivery) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Delivery not found' }); }

    const isDelivered = status === 'delivered';
    const updDelivery = await client.query(
      `UPDATE deliveries SET status = $1, delivery_date = ${isDelivered ? 'CURRENT_TIMESTAMP' : 'delivery_date'}
       WHERE delivery_id = $2 RETURNING *`,
      [status, delivery_id]
    );

    let order = null;
    if (isDelivered) {
      const updOrder = await client.query(
        `UPDATE orders
         SET status = 'delivered',
             payment_status = CASE
               WHEN payment_method = 'cash_on_delivery' THEN 'paid'
               ELSE payment_status
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
         RETURNING *`,
        [delivery.order_id]
      );
      order = updOrder.rows[0];
      await client.query(
        `INSERT INTO notifications (user_id, text, topic) VALUES ($1, $2, 'order')`,
        [order.customer_id, `Order #${order.order_id} has been delivered. We'd love to hear what you thought — leave a review!`]
      );
    }

    await client.query('COMMIT');
    res.json({ delivery: updDelivery.rows[0], order });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating delivery status:', err.message);
    res.status(500).json({ error: 'Failed to update delivery status' });
  } finally {
    client.release();
  }
});

// ====================================================================
// DELIVERYMEN — basic CRUD for the pool of riders admins assign orders to
// ====================================================================

router.get('/deliverymen', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deliverymen ORDER BY is_active DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching deliverymen:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/deliverymen', async (req, res) => {
  const { name, phone, vehicle_type } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  try {
    const result = await pool.query(
      'INSERT INTO deliverymen (name, phone, vehicle_type) VALUES ($1,$2,$3) RETURNING *',
      [name, phone, vehicle_type || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating deliveryman:', err.message);
    res.status(500).json({ error: 'Failed to add deliveryman' });
  }
});

router.put('/deliverymen/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, vehicle_type, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deliverymen SET name = $1, phone = $2, vehicle_type = $3, is_active = $4 WHERE deliveryman_id = $5 RETURNING *`,
      [name, phone, vehicle_type || null, is_active !== undefined ? is_active : true, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliveryman not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating deliveryman:', err.message);
    res.status(500).json({ error: 'Failed to update deliveryman' });
  }
});

router.delete('/deliverymen/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Riders with delivery history are deactivated instead of deleted so
    // past orders keep a valid reference; only unused riders are removed.
    const inUse = await pool.query('SELECT 1 FROM deliveries WHERE deliveryman_id = $1 LIMIT 1', [id]);
    if (inUse.rows.length > 0) {
      const result = await pool.query('UPDATE deliverymen SET is_active = FALSE WHERE deliveryman_id = $1 RETURNING *', [id]);
      return res.json({ message: 'Deliveryman has delivery history and was deactivated instead of deleted', deliveryman: result.rows[0] });
    }
    const result = await pool.query('DELETE FROM deliverymen WHERE deliveryman_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deliveryman not found' });
    res.json({ message: 'Deliveryman removed' });
  } catch (err) {
    console.error('Error deleting deliveryman:', err.message);
    res.status(500).json({ error: 'Failed to delete deliveryman' });
  }
});

module.exports = router;