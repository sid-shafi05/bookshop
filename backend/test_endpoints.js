const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Testing analytics endpoints...');
    const stats = await pool.query('SELECT * FROM fn_quick_stats()');
    console.log('✅ fn_quick_stats:', stats.rows[0]);
    
    const revenue = await pool.query('SELECT * FROM fn_monthly_revenue(12)');
    console.log('✅ fn_monthly_revenue:', revenue.rows.length, 'months');
    
    const topBooks = await pool.query('SELECT * FROM fn_top_selling_books(10)');
    console.log('✅ fn_top_selling_books:', topBooks.rows.length, 'books');
    
    console.log('\nTesting returns endpoint...');
    const returns = await pool.query('SELECT * FROM returns');
    console.log('✅ returns table:', returns.rows.length, 'rows');
    
    console.log('\n✅ All endpoints working!');
  } catch (e) { console.error('Error:', e.message); }
  finally { await pool.end(); }
}
run();