const pool = require('./db');

async function main() {
  const cutoff = '2026-09-18T00:00:00Z';

  const idsRes = await pool.query(
    `SELECT book_id
     FROM books
     WHERE created_at >= $1
     ORDER BY book_id ASC`,
    [cutoff]
  );

  const ids = idsRes.rows.map((row) => Number(row.book_id));

  if (ids.length === 0) {
    console.log(JSON.stringify({ deleted: 0, remainingBooks: 0 }, null, 2));
    await pool.end();
    return;
  }

  await pool.query('DELETE FROM book_categories WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM book_authors WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM reviews WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM order_items WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM wishlist_items WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM carts WHERE cart_id IN (SELECT cart_id FROM cart_items WHERE book_id = ANY($1))', [ids]);
  await pool.query('DELETE FROM cart_items WHERE book_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM books WHERE book_id = ANY($1)', [ids]);

  await pool.query(`
    DELETE FROM authors a
    WHERE NOT EXISTS (
      SELECT 1 FROM book_authors ba WHERE ba.author_id = a.author_id
    )
  `);

  await pool.query(`
    DELETE FROM publishers p
    WHERE NOT EXISTS (
      SELECT 1 FROM books b WHERE b.publisher_id = p.publisher_id
    )
  `);

  const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM books');
  console.log(JSON.stringify({ deleted: ids.length, remainingBooks: Number(countRes.rows[0].count) }, null, 2));
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
