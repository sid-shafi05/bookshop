// backend/utils/notify.js
//
// Central place that creates an in-app notification row AND fires the
// matching email. Use this everywhere instead of raw
// `INSERT INTO notifications ...` so every event stays consistent.
//
// notify({ userId, text, topic, referenceType, referenceId, client })
//   - userId:        who the notification belongs to (customer, admin, or deliveryman)
//   - text:          human-readable message (used for both the in-app row and email body)
//   - topic:         'order' | 'delivery' | 'account' | 'general' (drives the email subject
//                     and lets the frontend pick an icon/section)
//   - referenceType: 'order' | 'delivery' (optional) — what reference_id points to
//   - referenceId:   the order_id / delivery_id (optional) — lets the frontend's
//                     notification click jump straight to that order/delivery page
//   - client:        pass the active pg client if you're inside a transaction, so the
//                     notification insert commits/rolls back with everything else.
//                     The email lookup+send always uses the plain pool, since it may
//                     run after the transaction's client has been released.
//
// notifyAdmins({ ...same fields minus userId }) fans the same notification out to
// every user with role = 'admin'.

const pool = require('../db');
const { sendEmail } = require('./email');

const SUBJECTS = {
  order: 'Order update — BookHarbour',
  delivery: 'Delivery update — BookHarbour',
  account: 'Your BookHarbour account',
  general: 'BookHarbour notification',
};

async function notify({ userId, text, topic = 'general', referenceType = null, referenceId = null, client = null }) {
  const db = client || pool;

  const result = await db.query(
    `INSERT INTO notifications (user_id, text, topic, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, text, topic, referenceType, referenceId]
  );
  const notification = result.rows[0];

  // Fire-and-forget: never let an email failure (or a transaction client that's
  // already been released) break the caller's actual request.
  pool.query('SELECT email FROM users WHERE user_id = $1', [userId])
    .then(({ rows }) => {
      const email = rows[0]?.email;
      if (!email) return;
      return sendEmail({ to: email, subject: SUBJECTS[topic] || SUBJECTS.general, text });
    })
    .catch(err => console.error('notify(): email send failed:', err.message));

  return notification;
}

async function notifyAdmins({ text, topic = 'general', referenceType = null, referenceId = null, client = null }) {
  const db = client || pool;
  const { rows: admins } = await db.query(`SELECT user_id FROM users WHERE role = 'admin'`);
  return Promise.all(
    admins.map(a => notify({ userId: a.user_id, text, topic, referenceType, referenceId, client }))
  );
}

async function notifyCustomers({ text, topic = 'general', referenceType = null, referenceId = null, client = null }) {
  const db = client || pool;
  const { rows: customers } = await db.query(`SELECT user_id FROM users WHERE role = 'customer'`);
  return Promise.all(
    customers.map(c => notify({ userId: c.user_id, text, topic, referenceType, referenceId, client }))
  );
}

module.exports = { notify, notifyAdmins, notifyCustomers };   // add notifyCustomers here