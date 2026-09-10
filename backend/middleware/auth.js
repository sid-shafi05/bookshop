const jwt = require('jsonwebtoken');
const pool = require('../db');

// Verify token middleware
const verifyToken = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.bookstore_token) {
    token = req.cookies.bookstore_token;
  }

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // blacklist check (optional table)
    try {
      const blacklisted = await pool.query(
        'SELECT 1 FROM token_blacklist WHERE token = $1 LIMIT 1',
        [token]
      );
      if (blacklisted.rows.length > 0) {
        return res.status(401).json({ error: 'Token has been invalidated' });
      }
    } catch (e) {
      // ignore if table doesn't exist yet
    }

    req.userId = decoded.userId;
    req.role = decoded.role;
    req.token = token;
    next();
  } catch (err) {
    console.log('JWT VERIFY ERROR:', err.name, err.message);
    return res.status(401).json({ error: 'Failed to authenticate token' });
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Require customer role
const requireCustomer = (req, res, next) => {
  if (req.role !== 'customer') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Require deliveryman role
const requireDeliveryman = (req, res, next) => {
  if (req.role !== 'deliveryman') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin, requireCustomer, requireDeliveryman };