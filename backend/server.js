// author: caitriona mccann
// date: 26/11/2025
// main backend server - handles api routes for scans, users, and item types
// connects to postgres database and runs on port 3000

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const pool = require('./database/db');
const scansRouter = require('./routes/scans');
const usersRouter = require('./routes/users');
const itemTypesRouter = require('./routes/itemTypes');

const app = express();
const PORT = process.env.PORT || 3000;

// middleware for cors, json parsing, and url encoding
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// api routes
app.use('/api/scans', scansRouter);
app.use('/api/users', usersRouter);
app.use('/api/item-types', itemTypesRouter);

// health check endpoint to verify database connection
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// root endpoint showing available routes
app.get('/', (req, res) => {
  res.json({
    name: 'WearAware API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      scans: '/api/scans',
      users: '/api/users',
      itemTypes: '/api/item-types',
    },
  });
});

// catch-all error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// start server and listen on port
app.listen(PORT, () => {
  console.log(`\nWearAware Backend Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   API docs: http://localhost:${PORT}/\n`);
});


