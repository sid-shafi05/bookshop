const express= require('express');
const pool = require('./db');
require('dotenv').config();
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use('/auth', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/books', require('./routes/books'));
app.use('/wishlist', require('./routes/wishlist'));
app.use('/orders', require('./routes/orders'));
app.use('/reviews', require('./routes/reviews'));
app.use('/admin', require('./routes/admin'));
app.use('/admin/returns', require('./routes/adminreturns'));
app.use('/admin/analytics', require('./routes/analytics'));
app.use('/notifications', require('./routes/notifications')); // NEW — was missing entirely
app.use('/deliveryman', require('./routes/deliveryman'));      // NEW — file existed but was never mounted
const path = require('path');
app.use('/images/books', express.static(path.join(__dirname, 'uploads', 'books')));

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing backend process before starting another one.`);
    process.exitCode = 1;
    return;
  }
  console.error('Backend server error:', err.message);
  process.exitCode = 1;
});