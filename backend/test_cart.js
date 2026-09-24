const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const book = await pool.query('SELECT book_id, title, stock_quantity FROM books WHERE stock_quantity < 5 LIMIT 1');
    if (book.rows.length > 0) {
      const b = book.rows[0];
      console.log('Testing cart add with book:', b.title, 'Stock:', b.stock_quantity);
      
      const stock = b.stock_quantity;
      const addQty = stock + 1;
      const totalRequested = addQty;
      
      if (totalRequested > stock) {
        console.log('Error message would be:', 'Cannot request ' + totalRequested + ' copies of "' + b.title + '". Only ' + stock + ' available in stock.');
      }
    }
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();