const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Test all functions directly
    console.log('Testing analytics functions...');
    
    const quickStats = await pool.query('SELECT * FROM fn_quick_stats()');
    console.log('✅ fn_quick_stats:', quickStats.rows[0]);
    
    const revenue = await pool.query('SELECT * FROM fn_monthly_revenue(12)');
    console.log('✅ fn_monthly_revenue:', revenue.rows.length, 'months');
    
    const topBooks = await pool.query('SELECT * FROM fn_top_selling_books(10)');
    console.log('✅ fn_top_selling_books:', topBooks.rows.length, 'books');
    
    const lowStock = await pool.query('SELECT * FROM fn_low_stock_books(10)');
    console.log('✅ fn_low_stock_books:', lowStock.rows.length, 'books');
    
    const catRevenue = await pool.query('SELECT * FROM fn_category_revenue()');
    console.log('✅ fn_category_revenue:', catRevenue.rows.length, 'categories');
    
    const topRated = await pool.query('SELECT * FROM fn_top_rated_books(10)');
    console.log('✅ fn_top_rated_books:', topRated.rows.length, 'books');
    
    console.log('\n✅ All analytics functions working!');
  } catch (e) { console.error('Error:', e.message); }
  finally { await pool.end(); }
}
run();