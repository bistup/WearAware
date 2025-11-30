// author: caitriona mccann
// date: 26/11/2025
// user management routes - syncs firebase users with postgres database

const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// sync firebase user to postgres or get existing user
router.post('/sync', async (req, res) => {
  const { firebaseUid, email } = req.body;

  if (!firebaseUid || !email) {
    return res.status(400).json({ error: 'Firebase UID and email required' });
  }

  try {
    // check if user already exists in database
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (existingUser.rows.length > 0) {
      return res.json({
        success: true,
        user: existingUser.rows[0],
        message: 'User found',
      });
    }

    // create new user record
    const newUser = await pool.query(
      'INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING *',
      [firebaseUid, email]
    );

    res.json({
      success: true,
      user: newUser.rows[0],
      message: 'User created',
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message });
  }
});

// fetch user by firebase id
router.get('/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


