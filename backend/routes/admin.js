const express = require('express');
const router= express.Router();
const pool = require('../db');

const { verifyToken, requireAdmin } = require('../middleware/auth');

// Add a new book (admin only)
router.post('/books', verifyToken, requireAdmin, async (req, res) => {
    const { title, isbn, price, stock_quantity, publication_year } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO books (title, isbn, price, stock_quantity, publication_year) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, isbn, price, stock_quantity, publication_year]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding book:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/books', verifyToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM books');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching books:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/books/:id', verifyToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, isbn, price, stock_quantity, publication_year } = req.body;

    try {
        const result = await pool.query(
            'UPDATE books SET title = $1, isbn = $2, price = $3, stock_quantity = $4, publication_year = $5 WHERE book_id = $6 RETURNING *',
            [title, isbn, price, stock_quantity, publication_year, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating book:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/books/:id', verifyToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM books WHERE ibook_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.status(200).json({ message: 'Book deleted successfully' });
    }   catch (err) {
        console.error('Error deleting book:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// GET all users (admin only, read-only)
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
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

// GET all orders with customer info
router.get('/orders', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.order_id, o.status, o.total_amount, o.order_date, o.payment_method,
             u.username, u.email
      FROM orders o
      JOIN users u ON u.user_id = o.customer_id
      ORDER BY o.order_date DESC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update order status
router.put('/orders/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
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
module.exports = router;