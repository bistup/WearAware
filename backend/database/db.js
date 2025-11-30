// author: caitriona mccann
// date: 26/11/2025
// postgres database connection pool
// handles all database connections for the backend

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'wearaware',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // max connections in pool
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 2000, // timeout if can't connect in 2s
});

// log successful connections
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

// handle connection errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1); // exit if database connection fails
});

module.exports = pool;


