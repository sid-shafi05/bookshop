const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /notifications -> current user's notifications, newest first
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT notification_id, text, topic, entity_type, entity_id, is_read, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', async (req, res) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [req.userId]
  );
  res.json(result.rows[0]);
});

// PUT /notifications/:id/read
router.put('/:id/read', async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// PUT /notifications/read-all
router.put('/read-all', async (req, res) => {
  await pool.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.userId]);
  res.json({ message: 'All marked read' });
});

module.exports = router;