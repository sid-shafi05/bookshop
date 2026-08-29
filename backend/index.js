const express= require('express');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors()); 

app.use('/auth', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/books', require('./routes/books'));
app.use('/wishlist', require('./routes/wishlist'));
app.use('/admin', require('./routes/admin'));
const path = require('path');
app.use('/images/books', express.static(path.join(__dirname, 'uploads', 'books')));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});