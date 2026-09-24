const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Check stock validation function
    const fnRes = await pool.query(`
      SELECT proname FROM pg_proc WHERE proname = 'fn_validate_stock'
    `);
    console.log('fn_validate_stock exists:', fnRes.rows.length > 0);

    // Check triggers
    const triggers = await pool.query(`
      SELECT trigger_name, event_object_table, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `);
    console.log('Triggers:');
    triggers.rows.forEach(t => console.log(`  ${t.trigger_name} on ${t.event_object_table} (${t.action_timing})`));

    // Check review trigger function
    const reviewFn = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'fn_verify_review_eligibility'
    `);
    const src = reviewFn.rows[0]?.prosrc || '';
    console.log('\nReview trigger uses deliveries table:', src.includes('deliveries'));
    console.log('Review trigger checks d.status:', src.includes('d.status'));
    console.log('Review trigger uses o.customer_id:', src.includes('o.customer_id'));

  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();