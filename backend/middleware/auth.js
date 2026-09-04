const jwt = require('jsonwebtoken');
const pool = require('../db');
// Verify token middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.bookstore_token;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // 1. CHECK SERVER-SIDE BLACKLIST (Fulfills Section 3.1 Real Logout!)
    const blacklistCheck = await pool.query(
      'SELECT 1 FROM token_blacklist WHERE token = $1',
      [token]
    );

    if (blacklistCheck.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
    }

    // 2. VERIFY JWT SIGNATURE & EXPIRY
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('JWT VERIFY ERROR:', err.name, err.message);
        return res.status(401).json({ error: 'Failed to authenticate or expired token' });
      }

      // Attach credentials to request
       req.user = decoded;
      req.userId = decoded.userId;
      req.role = decoded.role;
      req.token = token; // Passed to logout route

      next();
    });
  } catch (dbErr) {
    console.error('Auth middleware database error:', dbErr.message);
    return res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied : Admin role required' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin };