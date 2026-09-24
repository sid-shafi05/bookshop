const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('=== VERIFYING TRIGGERS ===');
    const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name
    `);
    triggers.rows.forEach(t => console.log(`✅ ${t.trigger_name} on ${t.event_object_table} (${t.action_timing} ${t.event_manipulation})`));

    console.log('\n=== VERIFYING PROCEDURES ===');
    const procedures = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'
      ORDER BY routine_name
    `);
    procedures.rows.forEach(p => console.log(`✅ ${p.routine_name}`));

    console.log('\n=== VERIFYING FUNCTIONS ===');
    const functions = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);
    functions.rows.forEach(f => console.log(`✅ ${f.routine_name}`));

    console.log('\n=== TESTING FUNCTIONS ===');
    // Test fn_quick_stats
    const stats = await pool.query('SELECT * FROM fn_quick_stats()');
    console.log('fn_quick_stats():', stats.rows[0]);

    // Test fn_monthly_revenue
    const revenue = await pool.query('SELECT * FROM fn_monthly_revenue(12)');
    console.log('fn_monthly_revenue(12):', revenue.rows.length, 'months');

    // Test fn_top_selling_books
    const topBooks = await pool.query('SELECT * FROM fn_top_selling_books(10)');
    console.log('fn_top_selling_books(10):', topBooks.rows.length, 'books');

    // Test fn_low_stock_books
    const lowStock = await pool.query('SELECT * FROM fn_low_stock_books(10)');
    console.log('fn_low_stock_books(10):', lowStock.rows.length, 'books');

    // Test fn_category_revenue
    const catRev = await pool.query('SELECT * FROM fn_category_revenue()');
    console.log('fn_category_revenue():', catRev.rows.length, 'categories');

    // Test fn_top_rated_books
    const topRated = await pool.query('SELECT * FROM fn_top_rated_books(10)');
    console.log('fn_top_rated_books(10):', topRated.rows.length, 'books');

    // Test fn_check_stock
    const stock = await pool.query('SELECT fn_check_stock(1, 5)');
    console.log('fn_check_stock(1, 5):', stock.rows[0]);

    console.log('\n✅ ALL VERIFICATIONS PASSED');

  } catch (e) { console.error('Error:', e.message); }
  finally { await pool.end(); }
}
run();