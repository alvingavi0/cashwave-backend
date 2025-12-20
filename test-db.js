// test-db.js - simple DB connectivity test
let db;
try {
  db = require('./_db');
} catch (e) {
  db = require('./api/_db');
}

db.query('SELECT NOW()').then(res => {
  console.log('DB OK:', res.rows);
}).catch(err => {
  console.error('DB connection error:', err.message || err);
}).finally(() => process.exit());
