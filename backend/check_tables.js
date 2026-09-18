const pool = require('./db');

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables found in Supabase:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error fetching tables:', err.message);
  } finally {
    pool.end();
  }
}

checkTables();