// author: caitriona mccann
// date: 26/11/2025
// postgres connection pool and shared helpers

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'wearaware',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('connected to postgresql'));
pool.on('error', (err) => {
  console.error('database error:', err);
  process.exit(-1);
});

// resolve internal user id from firebase uid
async function getUserId(firebaseUid) {
  const result = await pool.query(
    'SELECT id FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

module.exports = pool;
module.exports.getUserId = getUserId;


