const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

// GET /admin/analytics/quick-stats - Quick dashboard stats
router.get('/quick-stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fn_quick_stats()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching quick stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch quick stats' });
  }
});

// GET /admin/analytics/revenue - Monthly revenue trend
router.get('/revenue', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const result = await pool.query('SELECT * FROM fn_monthly_revenue($1)', [months]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching revenue:', err.message);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// GET /admin/analytics/top-books - Top selling books
router.get('/top-books', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await pool.query('SELECT * FROM fn_top_selling_books($1)', [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching top books:', err.message);
    res.status(500).json({ error: 'Failed to fetch top books' });
  }
});

// GET /admin/analytics/low-stock - Low stock books
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const result = await pool.query('SELECT * FROM fn_low_stock_books($1)', [threshold]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock:', err.message);
    res.status(500).json({ error: 'Failed to fetch low stock books' });
  }
});

// GET /admin/analytics/category-revenue - Revenue by category
router.get('/category-revenue', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fn_category_revenue()');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching category revenue:', err.message);
    res.status(500).json({ error: 'Failed to fetch category revenue' });
  }
});

// GET /admin/analytics/top-rated - Top rated books
router.get('/top-rated', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await pool.query('SELECT * FROM fn_top_rated_books($1)', [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching top rated books:', err.message);
    res.status(500).json({ error: 'Failed to fetch top rated books' });
  }
});

// GET /admin/analytics/order-funnel - Order status funnel
router.get('/order-funnel', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH funnel_stages(status, sort_order) AS (
        VALUES
          ('pending', 1),
          ('confirmed', 2),
          ('processing', 3),
          ('shipped', 4),
          ('delivered', 5),
          ('partially_returned', 6),
          ('returned', 7)
      ), order_totals AS (
        SELECT o.status,
          o.total_amount - COALESCE(refunds.refund_total, 0) AS net_total
        FROM orders o
        LEFT JOIN (
          SELECT order_id, SUM(refund_amount) AS refund_total
          FROM returns
          WHERE status IN ('approved', 'processed')
          GROUP BY order_id
        ) refunds ON refunds.order_id = o.order_id
        WHERE o.status <> 'cancelled'
      ), grouped_orders AS (
        SELECT status, COUNT(*)::int AS count, SUM(net_total) AS total_amount
        FROM order_totals
        GROUP BY status
      )
      SELECT funnel_stages.status,
        COALESCE(grouped_orders.count, 0)::int AS count,
        COALESCE(grouped_orders.total_amount, 0) AS total_amount
      FROM funnel_stages
      LEFT JOIN grouped_orders ON grouped_orders.status = funnel_stages.status
      ORDER BY funnel_stages.sort_order
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching order funnel:', err.message);
    res.status(500).json({ error: 'Failed to fetch order funnel' });
  }
});

module.exports = router;