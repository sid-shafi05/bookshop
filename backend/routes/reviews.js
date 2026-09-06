// backend/routes/reviews.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// Add verifyToken middleware to ALL wishlist routes
router.use(verifyToken);


// GET /reviews/book/:book_id -> all reviews + average rating for a book
router.get('/book/:book_id', async (req, res) => {
  try {
    const reviewsRes = await pool.query(
      `SELECT r.review_id, r.rating, r.comment, r.review_date, u.username
       FROM reviews r
       JOIN users u ON u.user_id = r.customer_id
       WHERE r.book_id = $1
       ORDER BY r.review_date DESC`,
      [req.params.book_id]
    );
    const avgRes = await pool.query(
      `SELECT COALESCE(AVG(rating), 0)::numeric(3,2) AS avg_rating, COUNT(*)::int AS review_count
       FROM reviews WHERE book_id = $1`,
      [req.params.book_id]
    );
    res.json({ reviews: reviewsRes.rows, ...avgRes.rows[0] });
  } catch (err) {
    console.error('Error fetching reviews:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /reviews/eligibility/:customer_id/:book_id
// -> can this customer leave a review for this book right now?
router.get('/eligibility/:customer_id/:book_id', async (req, res) => {
  const { customer_id, book_id } = req.params;
  try {
    const alreadyRes = await pool.query(
      'SELECT 1 FROM reviews WHERE customer_id = $1 AND book_id = $2',
      [customer_id, book_id]
    );
    if (alreadyRes.rows.length > 0) {
      return res.json({ eligible: false, reason: 'already_reviewed' });
    }

    const deliveredRes = await pool.query(
      `SELECT 1 FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.customer_id = $1 AND oi.book_id = $2 AND o.status = 'delivered'
       LIMIT 1`,
      [customer_id, book_id]
    );
    const eligible = deliveredRes.rows.length > 0;
    res.json({ eligible, reason: eligible ? null : 'not_delivered' });
  } catch (err) {
    console.error('Error checking review eligibility:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /reviews -> submit a review
// Body: { customer_id, book_id, rating, comment }
router.post('/', async (req, res) => {
  const { customer_id, book_id, rating, comment } = req.body;

  if (!customer_id || !book_id || !rating) {
    return res.status(400).json({ error: 'customer_id, book_id and rating are required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // Enforce server-side: only customers who actually received the book can review it
    const deliveredRes = await pool.query(
      `SELECT 1 FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.customer_id = $1 AND oi.book_id = $2 AND o.status = 'delivered'
       LIMIT 1`,
      [customer_id, book_id]
    );
    if (deliveredRes.rows.length === 0) {
      return res.status(403).json({ error: 'You can only review books from orders that have been delivered to you' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (customer_id, book_id, rating, comment)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [customer_id, book_id, rating, comment || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation -> one_review_per_customer
      return res.status(409).json({ error: 'You already reviewed this book' });
    }
    console.error('Error creating review:', err.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

module.exports = router;