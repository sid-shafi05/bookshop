const express = require('express');
const pool = require('./db');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use('/auth', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/books', require('./routes/books'));
app.use('/wishlist', require('./routes/wishlist'));
app.use('/orders', require('./routes/orders'));
app.use('/reviews', require('./routes/reviews'));
app.use('/admin', require('./routes/admin'));
app.use('/deliveryman', require('./routes/deliveryman')); // NEW

app.use('/images/books', express.static(path.join(__dirname, 'uploads', 'books')));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});