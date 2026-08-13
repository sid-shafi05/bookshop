const express= require('express');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use('/auth', require('./routes/auth'));

app.get('/books', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});