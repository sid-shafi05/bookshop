const express = require('express');
const pool = require('./db');
const app = express();
app.use(express.json());
app.use('/admin', require('./routes/analytics'));
app.use('/admin', require('./routes/adminreturns'));
const server = app.listen(3001, () => {
  console.log('Test server on 3001');
  setTimeout(() => {
    server.close();
    process.exit(0);
  }, 5000);
});