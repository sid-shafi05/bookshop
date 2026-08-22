// backend/routes/books.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Master reusable query for fetching book details with publisher, authors, and categories
const BASE_SELECT = `
  SELECT
    b.book_id,
    b.title,
    b.price,
    b.stock_quantity,
    b.cover_url,
    b.description,
    b.publication_year,
    p.name AS publisher_name,
    COALESCE(
      (SELECT array_agg(a.name) FROM book_authors ba
        JOIN authors a ON a.author_id = ba.author_id
        WHERE ba.book_id = b.book_id),
      '{}'
    ) AS authors,
    COALESCE(
      (SELECT array_agg(c.category_name) FROM book_categories bc
        JOIN categories c ON c.category_id = bc.category_id
        WHERE bc.book_id = b.book_id),
      '{}'
    ) AS categories
  FROM books b
  LEFT JOIN publishers p ON p.publisher_id = b.publisher_id
`;

// ====================================================================
// 1. GET /books -> Main catalog (Supports ?genre=, ?limit=, ?offset=)
// ====================================================================
router.get('/', async (req, res) => {
  const { genre, limit = 50, offset = 0 } = req.query;

  try {
    const params = [];
    let query = BASE_SELECT;

    if (genre && genre !== 'All') {
      params.push(genre);
      query += ` WHERE EXISTS (
        SELECT 1 FROM book_categories bc
        JOIN categories c ON c.category_id = bc.category_id
        WHERE bc.book_id = b.book_id AND c.category_name = $${params.length}
      )`;
    }

    query += ' ORDER BY b.book_id ASC';

    params.push(Number(limit));
    query += ` LIMIT $${params.length}`;
    params.push(Number(offset));
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// 2. GET /books/recent -> Recent/New arrivals
// ====================================================================
router.get('/recent', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 50);

  try {
    const result = await pool.query(
      `${BASE_SELECT} ORDER BY b.book_id DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent books:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// 3. GET /books/genres -> All categories with book count
// ====================================================================
router.get('/genres', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.category_name AS genre, COUNT(bc.book_id)::int AS book_count
       FROM categories c
       LEFT JOIN book_categories bc ON bc.category_id = c.category_id
       GROUP BY c.category_name
       ORDER BY c.category_name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching genres:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// 4. GET /books/genre/:genre -> Books by specific genre
// ====================================================================
router.get('/genre/:genre', async (req, res) => {
  const { genre } = req.params;
  const limit = Math.min(Number(req.query.limit) || 24, 100);

  try {
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE EXISTS (
         SELECT 1 FROM book_categories bc
         JOIN categories c ON c.category_id = bc.category_id
         WHERE bc.book_id = b.book_id AND c.category_name = $1
       )
       ORDER BY b.book_id ASC LIMIT $2`,
      [genre, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching books by genre:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ====================================================================
// 5. GET /books/:id -> Single book detail page
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`${BASE_SELECT} WHERE b.book_id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching book by ID:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;