const express = require('express');
const router = express.Router();
const pool = require('../db');

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
    ) AS categories,
    COALESCE(
      (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.book_id = b.book_id),
      0
    ) AS average_rating,
    COALESCE(
      (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.book_id),
      0
    )::int AS review_count
  FROM books b
  LEFT JOIN publishers p ON p.publisher_id = b.publisher_id
`;

// GET /books -> public catalog with pagination and dynamic category filter
router.get('/', async (req, res) => {
  const { genre } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const offset = (page - 1) * limit;

  try {
    const params = [];
    let whereClause = '';

    if (genre && genre !== 'All') {
      params.push(genre);
      whereClause = ` WHERE EXISTS (
        SELECT 1 FROM book_categories bc
        JOIN categories c ON c.category_id = bc.category_id
        WHERE bc.book_id = b.book_id AND c.category_name = $${params.length}
      )`;
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM books b
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    let query = `${BASE_SELECT} ${whereClause} ORDER BY b.book_id ASC`;
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/recent', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 50);
  try {
    const result = await pool.query(`${BASE_SELECT} ORDER BY b.book_id DESC LIMIT $1`, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent books:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// dynamic category dropdown source
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

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`${BASE_SELECT} WHERE b.book_id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching book by ID:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;