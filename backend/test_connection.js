const pool = require('./db');

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('FAILED:', err.message);
  else console.log('CONNECTED:', res.rows[0].now);
  pool.end();
});