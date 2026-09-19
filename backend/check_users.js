// backend/check_users.js
const pool = require('./db');

async function check() {
  try {
    const res = await pool.query('SELECT user_id, username, email, role FROM users;');
    console.log('--- ALL USERS IN CONNECTED DATABASE ---');
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

check();