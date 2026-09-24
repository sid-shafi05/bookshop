const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const book = await pool.query('SELECT book_id, title, stock_quantity FROM books WHERE stock_quantity < 5 LIMIT 1');
    if (book.rows.length > 0) {
      const b = book.rows[0];
      console.log('Book:', b.title, 'Stock:', b.stock_quantity);
      
      // Simulate the validateBookStock logic
      const stock = b.stock_quantity;
      const requested = stock + 1;
      const inCart = 0;
      const addQty = stock + 1;
      const totalRequested = inCart + addQty;
      
      if (totalRequested > stock) {
        console.log('Error message:', 'Cannot request ' + totalRequested + ' copies of "' + b.title + '". Only ' + stock + ' available in stock.');
      }
      
      // Also test when there's already items in cart
      const inCart2 = 1;
      const addQty2 = stock;
      const total2 = inCart2 + addQty2;
      
      if (total2 > stock) {
        console.log('Error with existing cart:', 'Cannot request ' + total2 + ' copies of "' + b.title + '". Only ' + stock + ' available in stock.');
      }
    }
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();