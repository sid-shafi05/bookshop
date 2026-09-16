// backend/utils/notify.js
const pool = require('../db');
const sendEmail = require('./mailer'); // nodemailer wrapper, see below

async function notify(client, { userId, text, topic, entityType, entityId, sendMail = true }) {
  const db = client || pool;
  const result = await db.query(
    `INSERT INTO notifications (user_id, text, topic, entity_type, entity_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, text, topic, entityType || null, entityId || null]
  );

  if (sendMail) {
    const userRes = await db.query('SELECT email, username FROM users WHERE user_id = $1', [userId]);
    const user = userRes.rows[0];
    if (user?.email) {
      sendEmail(user.email, topic || 'Notification', text).catch(err =>
        console.error('Email send failed:', err.message)
      );
    }
  }
  return result.rows[0];
}

module.exports = notify;