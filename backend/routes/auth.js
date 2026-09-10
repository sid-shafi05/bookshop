const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};
// SIGNUP
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

    await client.query(
      `INSERT INTO customers (customer_id) VALUES ($1)`,
      [newUser.user_id]
    );
    //create the two ddefault things a customer needs
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
      user: {
        id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
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

// LOGIN
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

// Restore the current user from the HttpOnly authentication cookie.
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, email, role FROM users WHERE user_id = $1',
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error restoring authenticated user:', err);
    res.status(500).json({ error: 'Failed to restore session' });
  }
});

// POST /auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    if(req.token){
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


router.post('/deliveryman-setup', async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!token || !username || !password) {
    return res.status(400).json({ error: 'Token, username, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const riderRes = await client.query(
      `SELECT * FROM deliverymen WHERE invite_token = $1 AND invite_token_expires > NOW() FOR UPDATE`,
      [token]
    );
    const rider = riderRes.rows[0];
    if (!rider) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired invite link' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `UPDATE users SET username = $1, password_hash = $2 WHERE user_id = $3`,
      [username, passwordHash, rider.user_id]
    );

    await client.query(
      `UPDATE deliverymen SET invite_token = NULL, invite_token_expires = NULL WHERE deliveryman_id = $1`,
      [rider.deliveryman_id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Account setup complete. You can now log in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    console.error('Error completing deliveryman setup:', err.message);
    res.status(500).json({ error: 'Failed to complete setup' });
  } finally {
    client.release();
  }
});

module.exports = router;