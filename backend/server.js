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
const summariesRouter = require('./routes/summaries');
const socialRouter = require('./routes/social');
const alternativesRouter = require('./routes/alternatives');
const gamificationRouter = require('./routes/gamification');
const uploadsRouter = require('./routes/uploads');
const charityShopsRouter = require('./routes/charityShops');
const wardrobeRouter = require('./routes/wardrobe');
const outfitsRouter = require('./routes/outfits');
const path = require('path');
const {
  optionalFirebaseAuth,
  requireFirebaseAuth,
  rejectUidWithoutAuth,
  bindAuthUid,
} = require('./middleware/firebaseAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// middleware for cors, json parsing, and url encoding
app.use(cors());
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '15mb' }));

// serve uploaded images as static files (no directory listing)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'ignore',
  index: false,
  maxAge: '7d',
}));

// log all incoming requests (omit body to avoid leaking sensitive data)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// api routes
app.use('/api/scans', requireFirebaseAuth, bindAuthUid, scansRouter);
app.use('/api/users', usersRouter);
app.use('/api/item-types', itemTypesRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/social', optionalFirebaseAuth, rejectUidWithoutAuth, bindAuthUid, socialRouter);
app.use('/api/alternatives', requireFirebaseAuth, bindAuthUid, alternativesRouter);
app.use('/api/gamification', requireFirebaseAuth, bindAuthUid, gamificationRouter);
app.use('/api/uploads', requireFirebaseAuth, bindAuthUid, uploadsRouter);
app.use('/api/charity-shops', requireFirebaseAuth, bindAuthUid, charityShopsRouter);
app.use('/api/wardrobe', requireFirebaseAuth, bindAuthUid, wardrobeRouter);
app.use('/api/outfits', requireFirebaseAuth, bindAuthUid, outfitsRouter);

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


