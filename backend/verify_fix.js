const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'fn_verify_review_eligibility'
    `);
    const src = res.rows[0].prosrc;
    console.log('Function source contains o.customer_id:', src.includes('o.customer_id'));
    console.log('Function source contains oi.customer_id:', src.includes('oi.customer_id'));
    console.log('Function source contains d.status:', src.includes('d.status'));
    console.log('--- Source ---');
    console.log(src);
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();