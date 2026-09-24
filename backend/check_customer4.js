const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Check if customer 4 has returned orders with delivered deliveries
    const returned = await pool.query(`
      SELECT o.order_id, o.status, o.customer_id, oi.book_id, d.status as delivery_status, b.title
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN deliveries d ON d.order_id = o.order_id
      JOIN books b ON b.book_id = oi.book_id
      WHERE o.customer_id = 4
      AND o.status IN ('returned', 'partially_returned')
      AND d.status = 'delivered'
    `);
    console.log('Returned orders with delivered deliveries for customer 4:');
    returned.rows.forEach(r => console.log('  Order:', r.order_id, 'Status:', r.status, 'Book:', r.title, 'Delivery:', r.delivery_status));
    
    // Check all orders for customer 4
    const allOrders = await pool.query(`
      SELECT o.order_id, o.status, o.customer_id, oi.book_id, d.status as delivery_status, b.title
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN deliveries d ON d.order_id = o.order_id
      JOIN books b ON b.book_id = oi.book_id
      WHERE o.customer_id = 4
    `);
    console.log('\nAll orders for customer 4:');
    allOrders.rows.forEach(r => console.log('  Order:', r.order_id, 'Status:', r.status, 'Book:', r.title, 'Delivery:', r.delivery_status));
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();