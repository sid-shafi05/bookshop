// backend/test_admin_login.js
const pool = require('./db');
const bcrypt = require('bcrypt');

async function testLogin() {
  try {
    const email = 'newAdmin@gmail.com';
    const password = 'newAdmintest100';

    // 1. Look up user
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = res.rows[0];

    if (!user) {
      console.log('❌ User NOT found in Supabase! Email does not exist.');
      return;
    }

    console.log('✅ User found in DB:', {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      password_hash: user.password_hash ? user.password_hash.substring(0, 15) + '...' : null
    });

    // 2. Check password match
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 Password match test:', isMatch ? '✅ MATCHES!' : '❌ DOES NOT MATCH');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

testLogin();