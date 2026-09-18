// backend/new_admin.js
// Creates a valid admin account that can log in through the app.
// The app authenticates against the users table, not the admins table.
const pool = require('./db');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  const username = 'newAdmin10';
  const email = 'newAdminnew@gmail.com';
  const password = 'newAdmintest500';

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const userRes = await pool.query(
      `
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'admin')
        ON CONFLICT (email) DO UPDATE
        SET username = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            role = 'admin'
        RETURNING user_id;
      `,
      [username, email, passwordHash]
    );

    const adminUserId = userRes.rows[0].user_id;

    await pool.query(
      `
        INSERT INTO admins (admin_id)
        VALUES ($1)
        ON CONFLICT (admin_id) DO NOTHING;
      `,
      [adminUserId]
    );

    console.log('✅ Admin successfully created in Supabase!');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID:  ${adminUserId}`);
  } catch (err) {
    console.error('❌ Error inserting admin:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();