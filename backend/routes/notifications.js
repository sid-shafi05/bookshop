// backend/routes/notifications.js
//
// This is the piece that was entirely missing: notifications were being
// inserted into the table but there was no way to ever read them back.
// Mount this in index.js: app.use('/notifications', require('./routes/notifications'));

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /notifications -> the logged-in user's notifications, newest first.
// Works the same for a customer, admin, or deliveryman — it's just their user_id.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT notification_id, text, topic, reference_type, reference_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /notifications/unread-count -> for a bell-icon badge
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error counting notifications:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /notifications/:id/read -> mark one as read. Returns reference_type/id
// so the frontend can navigate ("prompt to that section") right after marking it.
router.put('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE notification_id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking notification read:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [req.userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;