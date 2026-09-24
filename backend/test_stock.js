const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Check trigger
    const triggers = await pool.query(`
      SELECT trigger_name, event_object_table, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `);
    console.log('Triggers:');
    triggers.rows.forEach(t => console.log('  ', t.trigger_name, 'on', t.event_object_table, t.action_timing, t.event_manipulation));
    
    // Test stock validation by inserting into order_items directly
    const book = await pool.query('SELECT book_id, stock_quantity FROM books WHERE stock_quantity < 5 LIMIT 1');
    if (book.rows.length > 0) {
      const b = book.rows[0];
      console.log('\nBook:', b.book_id, 'Stock:', b.stock_quantity);
      
      // Need an order first
      const order = await pool.query('INSERT INTO orders (customer_id, total_amount, status, payment_status) VALUES (3, 100, \'pending\', \'pending\') RETURNING order_id');
      const orderId = order.rows[0].order_id;
      
      try {
        await pool.query('INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES ($1, $2, $3, 100)', [orderId, b.book_id, b.stock_quantity + 1]);
        console.log('ERROR: Should have failed');
      } catch (e) {
        console.log('Stock validation works:', e.message.substring(0, 80));
      }
      
      // Cleanup
      await pool.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
    }
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();