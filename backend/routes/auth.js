const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

// SIGNUP (unchanged — public customer signup)
router.post('/signup', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer') RETURNING user_id, username, email, role`,
      [username, email, hashedPassword]
    );

    const newUser = result.rows[0];

    await client.query(`INSERT INTO customers (customer_id) VALUES ($1)`, [newUser.user_id]);
    await client.query(`INSERT INTO carts (customer_id) VALUES ($1)`, [newUser.user_id]);
    await client.query(`INSERT INTO wishlists (customer_id, wishlist_name) VALUES ($1, 'My Wishlist')`, [newUser.user_id]);
    await client.query('COMMIT');

    const token = jwt.sign(
      { userId: newUser.user_id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('bookstore_token', token, COOKIE_OPTIONS);
    res.status(201).json({
      user: { id: newUser.user_id, username: newUser.username, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
});

// LOGIN (unchanged)
router.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('bookstore_token', token, COOKIE_OPTIONS);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.user_id, username: user.username, role: user.role, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET /auth/me
// Now returns name + full address fields, not just id/username/email/role,
// so the profile-edit form (and "use my saved address" at checkout) can be
// prefilled without a second round trip. Works identically for customer,
// admin, or deliveryman — it's just their users row either way.
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, username, name, email, role, phone,
              house_no, street, city, postal_code, country
       FROM users WHERE user_id = $1`,
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.user_id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        house_no: user.house_no,
        street: user.street,
        city: user.city,
        postal_code: user.postal_code,
        country: user.country,
      }
    });
  } catch (err) {
    console.error('Error restoring authenticated user:', err);
    res.status(500).json({ error: 'Failed to restore session' });
  }
});

// PUT /auth/me -> self-service profile edit (works for customer, admin, or
// deliveryman alike — it's just their own users row).
// Body: any subset of { username, name, email, phone, house_no, street, city, postal_code, country }
//
// Added: `name` field, an application-level username-uniqueness check
// (the users table has no DB-level UNIQUE constraint on username, unlike
// email), and — for deliverymen — keeping the deliverymen roster row's
// name/phone in sync so the admin's rider list doesn't go stale.
router.put('/me', verifyToken, async (req, res) => {
  const fields = ['username', 'name', 'email', 'phone', 'house_no', 'street', 'city', 'postal_code', 'country'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  if (updates.username !== undefined && updates.username === '') {
    return res.status(400).json({ error: 'Username cannot be empty' });
  }
  if (updates.email !== undefined) {
    updates.email = updates.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(updates.email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Username has no DB-level UNIQUE constraint, so check explicitly to
    // give a clean 409 instead of silently allowing duplicates.
    if (updates.username !== undefined) {
      const dupe = await client.query(
        'SELECT 1 FROM users WHERE username = $1 AND user_id != $2',
        [updates.username, req.userId]
      );
      if (dupe.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'That username is already taken' });
      }
    }

    const setClauses = Object.keys(updates).map((f, i) => `${f} = $${i + 1}`);
    const values = Object.values(updates);
    values.push(req.userId);

    const result = await client.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE user_id = $${values.length}
       RETURNING user_id, username, name, email, role, phone, house_no, street, city, postal_code, country`,
      values
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const updated = result.rows[0];

    // Keep the deliverymen roster row's display name/phone in sync, so the
    // admin's "Deliverymen" list reflects what the rider set for themself.
    if (updated.role === 'deliveryman' && (updates.name !== undefined || updates.phone !== undefined)) {
      await client.query(
        `UPDATE deliverymen SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone)
         WHERE user_id = $3`,
        [updates.name !== undefined ? updates.name : null, updates.phone !== undefined ? updates.phone : null, req.userId]
      );
    }

    await client.query('COMMIT');
    res.json({
      message: 'Profile updated',
      user: {
        id: updated.user_id,
        username: updated.username,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        phone: updated.phone,
        house_no: updated.house_no,
        street: updated.street,
        city: updated.city,
        postal_code: updated.postal_code,
        country: updated.country,
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already in use by another account' });
    }
    console.error('Error updating profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    client.release();
  }
});

// POST /auth/logout (unchanged)
router.post('/logout', verifyToken, async (req, res) => {
  try {
    if (req.token) {
      await pool.query(
        'INSERT INTO token_blacklist (token) VALUES ($1) ON CONFLICT (token) DO NOTHING',
        [req.token]
      );
    }
    res.clearCookie('bookstore_token', COOKIE_OPTIONS);
    res.status(200).json({ message: 'Logged out successfully. Token invalidated on server.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ====================================================================
// INVITE-BASED REGISTRATION
// Shared by deliverymen (created via admin.js -> POST /admin/deliverymen)
// and, optionally, admins (see admin.js -> POST /admin/admins). The invite
// row already tells us the role and the email, so one pair of endpoints
// covers both: the admin who creates the account never has to know the
// new person's password, and the new person picks their own.
// ====================================================================

// GET /auth/invite/:token -> validate a token before showing the "finish
// setting up your account" form (prefills email, tells the frontend the role).
router.get('/invite/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT email, role, invited_name, expires_at FROM registration_invites
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [req.params.token]
    );
    const invite = result.rows[0];
    if (!invite) return res.status(404).json({ error: 'This invite link is invalid or has expired' });
    res.json({ email: invite.email, role: invite.role, name: invite.invited_name || null });
  } catch (err) {
    console.error('Error checking invite:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /auth/invite/:token/accept -> the invited person sets a username + password.
// Body: { username, password }
router.post('/invite/:token/accept', async (req, res) => {
  const { token } = req.params;
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteRes = await client.query(
      `SELECT * FROM registration_invites
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`,
      [token]
    );
    const invite = inviteRes.rows[0];
    if (!invite) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invite link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING user_id, username, email, role`,
      [username, invite.email, passwordHash, invite.role]
    );
    const user = userResult.rows[0];

    if (invite.role === 'deliveryman') {
      await client.query(
        `UPDATE deliverymen SET user_id = $1, is_active = TRUE WHERE deliveryman_id = $2`,
        [user.user_id, invite.deliveryman_id]
      );
    } else if (invite.role === 'admin') {
      await client.query(`INSERT INTO admins (admin_id) VALUES ($1)`, [user.user_id]);
    }

    await client.query(
      `UPDATE registration_invites SET used_at = CURRENT_TIMESTAMP WHERE token = $1`,
      [token]
    );
    await client.query('COMMIT');

    const jwtToken = jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('bookstore_token', jwtToken, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    console.error('Error accepting invite:', err.message);
    res.status(500).json({ error: 'Failed to complete registration' });
  } finally {
    client.release();
  }
});

module.exports = router;