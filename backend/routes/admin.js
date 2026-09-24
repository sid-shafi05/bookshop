const express = require('express');
const router= express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { notify, notifyAdmins , notifyCustomers} = require('../utils/notify');
const { sendEmail } = require('../utils/email');

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

async function findOrCreatePublisher(client, name) {
  const publisherName = typeof name === 'string' ? name.trim() : '';
  if (!publisherName) return null;

  const db = client || pool;
  const existing = await db.query(
    'SELECT publisher_id FROM publishers WHERE LOWER(name) = LOWER($1)',
    [publisherName]
  );

  if (existing.rows[0]) {
    return existing.rows[0].publisher_id;
  }

  const result = await db.query(
    'INSERT INTO publishers (name) VALUES ($1) RETURNING publisher_id',
    [publisherName]
  );

  return result.rows[0]?.publisher_id || null;
}

async function findOrCreateAuthor(client, name) {
  const authorName = typeof name === 'string' ? name.trim() : '';
  if (!authorName) return null;

  const db = client || pool;
  const existing = await db.query(
    'SELECT author_id FROM authors WHERE LOWER(name) = LOWER($1)',
    [authorName]
  );

  if (existing.rows[0]) {
    return existing.rows[0].author_id;
  }

  const result = await db.query(
    'INSERT INTO authors (name) VALUES ($1) RETURNING author_id',
    [authorName]
  );

  return result.rows[0]?.author_id || null;
}

function normalizeGoogleBookMetadata(item) {
  const info = item?.volumeInfo || {};
  const isbn =
    (info.industryIdentifiers || []).find((id) => id.type === 'ISBN_13')?.identifier ||
    (info.industryIdentifiers || []).find((id) => id.type === 'ISBN_10')?.identifier ||
    '';
  const published = info.publishedDate || '';
  const match = String(published).match(/\d{4}/);
  const publication_year = match ? Number(match[0]) : null;
  const description = typeof info.description === 'string'
    ? info.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  const cover_url =
    info.imageLinks?.extraLarge ||
    info.imageLinks?.large ||
    info.imageLinks?.medium ||
    info.imageLinks?.thumbnail ||
    '';

  return {
    title: info.title || '',
    isbn,
    description,
    publication_year,
    cover_url,
    authors: Array.isArray(info.authors) ? info.authors : [],
    publisher: info.publisher || ''
  };
}

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

router.put('/books/:id', upload.single('cover_image'), async (req, res) => {
    const { id } = req.params;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const isbn = typeof req.body.isbn === 'string' ? req.body.isbn.trim() || null : null;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const publisher_name = typeof req.body.publisher_name === 'string' ? req.body.publisher_name.trim() : '';
    const author_names = typeof req.body.author_names === 'string' ? req.body.author_names.trim() : '';
    const categoryIds = parseCategoryIds(req.body.category_ids || req.body.category_id || []);
    const price = Number(req.body.price);
    const stock_quantity = Number(req.body.stock_quantity);
    const publication_year = req.body.publication_year ? Number(req.body.publication_year) : null;
    const cover_url = req.file ? `/images/books/${req.file.filename}` : (req.body.existing_cover_url || null);

    try {
        const result = await pool.query(
            'UPDATE books SET title = $1, isbn = $2, description = $3, price = $4, stock_quantity = $5, publication_year = $6, cover_url = $7 WHERE book_id = $8 RETURNING *',
            [title, isbn, description || null, price, stock_quantity, publication_year || null, cover_url, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (publisher_name) {
          const publisherId = await findOrCreatePublisher(pool, publisher_name);
          if (publisherId) {
            await pool.query('UPDATE books SET publisher_id = $1 WHERE book_id = $2', [publisherId, id]);
          }
        }

        await pool.query('DELETE FROM book_authors WHERE book_id = $1', [id]);
        if (author_names) {
          const authors = author_names.split(',').map((name) => name.trim()).filter(Boolean);
          for (const authorName of authors) {
            const authorId = await findOrCreateAuthor(pool, authorName);
            if (authorId) {
              await pool.query('INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, authorId]);
            }
          }
        }

        await pool.query('DELETE FROM book_categories WHERE book_id = $1', [id]);
        if (categoryIds.length > 0) {
          for (const categoryId of categoryIds) {
            await pool.query('INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, categoryId]);
          }
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

router.post('/categories', async (req, res) => {
  const categoryName = typeof req.body.category_name === 'string'
    ? req.body.category_name.trim()
    : '';

  if (!categoryName) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const cleanCategoryName = categoryName.replace(/\s+/g, ' ');

  try {
    const result = await pool.query(
      `INSERT INTO categories (category_name)
       VALUES ($1)
       ON CONFLICT (category_name) DO NOTHING
       RETURNING category_id, category_name`,
      [cleanCategoryName]
    );

    if (result.rows.length > 0) {
      return res.status(201).json(result.rows[0]);
    }

    const existing = await pool.query(
      'SELECT category_id, category_name FROM categories WHERE LOWER(category_name) = LOWER($1)',
      [cleanCategoryName]
    );

    return res.status(200).json(existing.rows[0] || { category_name: cleanCategoryName });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/coupons', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (c.expiry_date IS NOT NULL AND c.expiry_date < CURRENT_DATE) AS expired
      FROM coupons c
      ORDER BY c.is_active DESC, c.expiry_date ASC NULLS LAST, c.coupon_id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching coupons:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


  try {
    values.push(couponId);
    const result = await pool.query(
      `UPDATE coupons
       SET ${fields.join(', ')}
       WHERE coupon_id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    const updatedCoupon = result.rows[0];
    if (updatedCoupon.is_active) {
      await notifyCustomers({
        text: `Coupon ${updatedCoupon.code} is now active: ${updatedCoupon.discount_percent}% off with a minimum spend of Tk ${updatedCoupon.min_order_amount || 0}.`,
        topic: 'general',
        referenceType: 'coupon',
        referenceId: updatedCoupon.coupon_id,
      });
    }

    res.json(updatedCoupon);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A coupon with this code already exists.' });
    }
    console.error('Error updating coupon:', err.message);
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
// ADMINS
//
// Changed to the same invite pattern as deliverymen (see the note at the
// bottom of this file for why): the inviting admin supplies username + email
// only; the new admin sets their own password via the emailed link.
// ====================================================================

router.post('/admins', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await client.query(
      `INSERT INTO registration_invites (token, email, role, invited_name, expires_at)
       VALUES ($1, $2, 'admin', $3, $4)`,
      [token, email, name, expiresAt]
    );
    await client.query('COMMIT');

    const link = `${FRONTEND_URL}/register/admin?token=${token}`;
    sendEmail({
      to: email,
      subject: 'You have been invited as a BookHarbour admin',
      text: `Hi ${name}, you've been invited to be an admin on BookHarbour. Finish setting up your account (choose your own username and password) here: ${link}\nThis link expires in 7 days.`
    }).catch(err => console.error('Admin invite email failed:', err.message));

    res.status(201).json({ message: `Invite sent to ${email}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inviting admin:', err.message);
    res.status(500).json({ error: 'Failed to send admin invite' });
  } finally {
    client.release();
  }
});

// USERS (read-only, unchanged)
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

// PUT /admin/users/:id -> admin edits ANY user's profile fields.
// Deliberately does NOT allow changing `role` here — promoting/demoting is a
// separate, more sensitive action; keep using the invite flow (POST /admin/admins)
// or a direct SQL promotion for that, not this general-purpose edit endpoint.
// Body: any subset of { username, email, phone, house_no, street, city, postal_code, country }
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['username', 'email', 'phone', 'house_no', 'street', 'city', 'postal_code', 'country'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  if (updates.username !== undefined && updates.username === '') {
    return res.status(400).json({ error: 'Username cannot be empty' });
  }
  if (updates.email !== undefined) {
    updates.email = updates.email.toLowerCase();
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
  }

  const setClauses = Object.keys(updates).map((f, i) => `${f} = $${i + 1}`);
  const values = Object.values(updates);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE user_id = $${values.length}
       RETURNING user_id, username, email, role, phone, house_no, street, city, postal_code, country`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already in use by another account' });
    }
    console.error('Error updating user:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ====================================================================
// ORDERS
// ====================================================================

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

router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled','returned','partially_returned'];
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
    await notify({
      userId: result.rows[0].customer_id,
      text: `Order #${id} status changed to "${status}".`,
      topic: 'order',
      referenceType: 'order',
      referenceId: Number(id),
    });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /admin/orders/:id/ship -> assign a deliveryman, create/refresh the
// delivery record as 'pending_acceptance', and move the order to 'shipped'.
// Now notifies BOTH the customer and the assigned rider (previously only
// the customer got a notification — the rider had no way to know a delivery
// was waiting on them beyond polling their dashboard).
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
    if (!rider.is_active) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'This deliveryman is inactive' }); }

    const existingRes = await client.query('SELECT * FROM deliveries WHERE order_id = $1', [id]);
    let delivery;
    if (existingRes.rows.length > 0) {
      const upd = await client.query(
        `UPDATE deliveries
         SET deliveryman_id = $1, rider_name = $2, rider_phone = $3,
             shipping_method = COALESCE($4, shipping_method),
             tracking_number = COALESCE($5, tracking_number),
             status = 'pending_acceptance',
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
         VALUES ($1,$2,$3,$4,$5,$6,'pending_acceptance',$7,$8,$9,$10,$11) RETURNING *`,
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

    await notify({
      userId: order.customer_id,
      text: `Order #${id} is on its way with ${rider.name} (${rider.phone}).`,
      topic: 'order',
      referenceType: 'order',
      referenceId: Number(id),
      client,
    });

    // NEW: the rider themself now gets told a delivery is waiting on them.
    if (rider.user_id) {
      await notify({
        userId: rider.user_id,
        text: `You've been assigned a new delivery for Order #${id}. Please accept or decline it from your dashboard.`,
        topic: 'delivery',
        referenceType: 'delivery',
        referenceId: delivery.delivery_id,
        client,
      });
    }

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

// PUT /admin/deliveries/:delivery_id/status -> manual admin override.
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
      await notify({
        userId: order.customer_id,
        text: `Order #${order.order_id} has been delivered. We'd love to hear what you thought — leave a review!`,
        topic: 'order',
        referenceType: 'order',
        referenceId: order.order_id,
        client,
      });

      await notifyAdmins({
        text: `Order #${order.order_id} has been marked delivered.`,
        topic: 'order',
        referenceType: 'order',
        referenceId: order.order_id,
        client,
      });
    } else {
      const orderRow = await client.query('SELECT customer_id FROM orders WHERE order_id = $1', [delivery.order_id]);
      if (orderRow.rows[0]) {
        await notify({
          userId: orderRow.rows[0].customer_id,
          text: `Your delivery for Order #${delivery.order_id} is now "${status.replace(/_/g, ' ')}".`,
          topic: 'delivery',
          referenceType: 'order',
          referenceId: delivery.order_id,
          client,
        });
      }
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
// DELIVERYMEN
//
// Changed from "admin sets the rider's username/email/password directly"
// to an invite flow, same shape as the admin invite above: admin supplies
// name/phone/vehicle_type/email, the roster row is created inactive with no
// login yet, and an email goes out with a link for the rider to set their
// own username + password. is_active flips TRUE only once they finish that.
// ====================================================================

router.get('/deliverymen', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT deliveryman_id, user_id, name, phone, vehicle_type, is_active, invite_email,
              (user_id IS NOT NULL) AS registered
       FROM deliverymen ORDER BY is_active DESC, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching deliverymen:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/deliverymen', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const vehicle_type = typeof req.body.vehicle_type === 'string' ? req.body.vehicle_type.trim() || null : null;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!name || !phone || !email) {
    return res.status(400).json({ error: 'Name, phone, and email are required' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const riderResult = await client.query(
      `INSERT INTO deliverymen (name, phone, vehicle_type, invite_email, is_active)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [name, phone, vehicle_type, email]
    );
    const rider = riderResult.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await client.query(
      `INSERT INTO registration_invites (token, email, role, deliveryman_id, expires_at)
       VALUES ($1, $2, 'deliveryman', $3, $4)`,
      [token, email, rider.deliveryman_id, expiresAt]
    );
    await client.query('COMMIT');

    const link = `${FRONTEND_URL}/deliveryman/setup?token=${token}`;
    sendEmail({
      to: email,
      subject: 'Set up your BookHarbour deliveryman account',
      text: `Hi ${name}, you've been added as a deliveryman on BookHarbour. Finish setting up your login (choose your own username and password) here: ${link}\nThis link expires in 7 days. Until you finish setup, you won't be assignable to deliveries.`
    }).catch(err => console.error('Deliveryman invite email failed:', err.message));

    res.status(201).json({ deliveryman: rider, message: `Invite sent to ${email}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inviting deliveryman:', err.message);
    res.status(500).json({ error: 'Failed to add deliveryman' });
  } finally {
    client.release();
  }
});

// Roster-only fields.
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inUse = await client.query('SELECT 1 FROM deliveries WHERE deliveryman_id = $1 LIMIT 1', [id]);
    if (inUse.rows.length > 0) {
      const result = await client.query('UPDATE deliverymen SET is_active = FALSE WHERE deliveryman_id = $1 RETURNING *', [id]);
      await client.query('COMMIT');
      return res.json({ message: 'Deliveryman has delivery history and was deactivated instead of deleted', deliveryman: result.rows[0] });
    }

    const riderRes = await client.query('DELETE FROM deliverymen WHERE deliveryman_id = $1 RETURNING *', [id]);
    if (riderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deliveryman not found' });
    }
    const rider = riderRes.rows[0];
    if (rider.user_id) {
      await client.query('DELETE FROM users WHERE user_id = $1', [rider.user_id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Deliveryman removed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting deliveryman:', err.message);
    res.status(500).json({ error: 'Failed to delete deliveryman' });
  } finally {
    client.release();
  }
});


// DELETE /admin/users/:id -> Admin deletes a non-admin user account
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch target user
    const userRes = await client.query(
      'SELECT user_id, email, role FROM users WHERE user_id = $1',
      [id]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userRes.rows[0];

    // 2. Prevent removing admin accounts
    if (targetUser.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
    }

    // 3. Prevent deletion if user has existing order history (preserves order records)
    const orderCheck = await client.query(
      'SELECT 1 FROM orders WHERE customer_id = $1 LIMIT 1',
      [id]
    );
    if (orderCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot delete user with existing purchase or order history.'
      });
    }

    // 4. Clean up dependent user records before deleting account
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM carts WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM wishlists WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM registration_invites WHERE email = $1', [targetUser.email]);

    // Decouple from deliverymen table if this user account belongs to a rider
    await client.query('UPDATE deliverymen SET user_id = NULL WHERE user_id = $1', [id]);

    // 5. Delete user from users table
    await client.query('DELETE FROM users WHERE user_id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: `User account (${targetUser.email}) removed successfully` });
  } catch (err) {
    await client.query('ROLLBACK');

    // Foreign Key constraint fallback
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete user due to linked activity records in the database.'
      });
    }

    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// ====================================================================
// COUPONS
//
// Creating a coupon notifies every existing customer (in-app + email,
// via notifyCustomers -> notify()) so they find out about it without
// having to check the storefront. usage_limit is optional (NULL = no
// cap); enforcement + the times_used counter live in routes/orders.js
// at checkout, where the coupon row is locked FOR UPDATE to avoid a
// race between two customers redeeming the last use at once.
// ====================================================================

router.get('/coupons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coupons ORDER BY coupon_id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching coupons:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/coupons', async (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const discount_percent = Number(req.body.discount_percent);
  const expiry_date = req.body.expiry_date || null;
  const min_order_amount = req.body.min_order_amount !== undefined && req.body.min_order_amount !== ''
    ? Number(req.body.min_order_amount) : 0;
  const max_discount = req.body.max_discount !== undefined && req.body.max_discount !== ''
    ? Number(req.body.max_discount) : null;
  const is_active = req.body.is_active !== undefined ? Boolean(req.body.is_active) : true;

  if (!code) return res.status(400).json({ error: 'Coupon code is required' });
  if (!Number.isFinite(discount_percent) || discount_percent <= 0 || discount_percent > 100) {
    return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
  }
  if (!Number.isFinite(min_order_amount) || min_order_amount < 0) {
    return res.status(400).json({ error: 'Minimum order amount must be zero or more' });
  }
  if (max_discount !== null && (!Number.isFinite(max_discount) || max_discount < 0)) {
    return res.status(400).json({ error: 'Max discount must be zero or more' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO coupons (code, discount_percent, expiry_date, min_order_amount, max_discount, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, discount_percent, expiry_date, min_order_amount, max_discount, is_active]
    );
    const coupon = result.rows[0];

    // Fire-and-forget: a slow/failed notification fan-out shouldn't hold up
    // the admin's "coupon created" response.
    const discountText = `${Number(coupon.discount_percent)}% off`;
    const minOrderText = Number(coupon.min_order_amount) > 0
      ? ` on orders over Tk ${Number(coupon.min_order_amount).toFixed(2)}` : '';
    const expiryText = coupon.expiry_date
      ? ` Valid until ${new Date(coupon.expiry_date).toLocaleDateString()}.` : '';

    notifyCustomers({
      text: `New coupon "${coupon.code}"! Get ${discountText}${minOrderText}.${expiryText} This coupon is active for unlimited use while valid.`,
      topic: 'general',
    }).catch(err => console.error('Coupon notification fan-out failed:', err.message));

    res.status(201).json(coupon);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A coupon with this code already exists' });
    }
    console.error('Error creating coupon:', err.message);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.put('/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['discount_percent', 'expiry_date', 'min_order_amount', 'max_discount', 'is_active'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f] === '' ? null : req.body[f];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  if (updates.discount_percent !== undefined) {
    const dp = Number(updates.discount_percent);
    if (!Number.isFinite(dp) || dp <= 0 || dp > 100) {
      return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
    }
  }

  const setClauses = Object.keys(updates).map((f, i) => `${f} = $${i + 1}`);
  const values = Object.values(updates);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE coupons SET ${setClauses.join(', ')} WHERE coupon_id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating coupon:', err.message);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// Coupons already applied to past orders stay valid on those orders
// (orders.coupon_id -> ON DELETE SET NULL), so a hard delete is actually
// safe — but we deactivate instead when there's order history, same
// pattern as deliverymen, so the admin doesn't lose the usage record.
router.delete('/coupons/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const inUse = await pool.query('SELECT 1 FROM orders WHERE coupon_id = $1 LIMIT 1', [id]);
    if (inUse.rows.length > 0) {
      const result = await pool.query(
        'UPDATE coupons SET is_active = FALSE WHERE coupon_id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
      return res.json({ message: 'Coupon has order history and was deactivated instead of deleted', coupon: result.rows[0] });
    }

    const result = await pool.query('DELETE FROM coupons WHERE coupon_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    console.error('Error deleting coupon:', err.message);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});
module.exports = router;