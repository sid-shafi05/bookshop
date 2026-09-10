const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /notifications -> current user's notifications, newest first
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT notification_id, text, topic, reference_type, reference_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /notifications/unread-count -> for the bell badge
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error counting notifications:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /notifications/:id/read -> mark a single notification read
router.put('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking notification read:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /notifications/read-all -> mark everything read (e.g. when bell dropdown opens)
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;