const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('=== Testing Stock Validation ===');
    const book = await pool.query('SELECT book_id, title, stock_quantity FROM books WHERE stock_quantity < 5 LIMIT 1');
    if (book.rows.length > 0) {
      const b = book.rows[0];
      console.log('Book:', b.title, 'Stock:', b.stock_quantity);
      
      try {
        await pool.query('INSERT INTO cart_items (cart_id, book_id, quantity) VALUES (1, $1, $2)', [b.book_id, b.stock_quantity + 1]);
        console.log('ERROR: Should have failed');
      } catch (e) {
        console.log('Stock validation works:', e.message.substring(0, 60));
      }
    }
    
    console.log('\n=== Testing Review Eligibility for Returned Book ===');
    const returned = await pool.query(`
      SELECT o.order_id, o.status, o.customer_id, oi.book_id, d.status as delivery_status
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN deliveries d ON d.order_id = o.order_id
      WHERE o.status IN ('returned', 'partially_returned')
      AND d.status = 'delivered'
      LIMIT 1
    `);
    
    if (returned.rows.length > 0) {
      const r = returned.rows[0];
      console.log('Found returned order with delivered delivery:', r);
      
      const eligible = await pool.query(`
        SELECT 1 FROM deliveries d
        JOIN orders o ON o.order_id = d.order_id
        JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.customer_id = $1 AND oi.book_id = $2 AND d.status = 'delivered'
      `, [r.customer_id, r.book_id]);
      
      console.log('Review eligible via deliveries check:', eligible.rows.length > 0);
    } else {
      console.log('No returned orders with delivered deliveries found');
    }
    
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();