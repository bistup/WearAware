// author: caitriona mccann
// date: 26/11/2025
// user management routes - syncs firebase users with postgres database

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const path = require('path');
const fs = require('fs');
const { requireFirebaseAuth, bindAuthUid } = require('../middleware/firebaseAuth');

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

// delete all data for the authenticated user - gdpr right to erasure
// deletes every table in dependency order, then deletes the user record itself
// image files on disk are also removed
router.delete('/my-account', requireFirebaseAuth, bindAuthUid, async (req, res) => {
  const uid = req.authUid;

  try {
    // look up internal user id from firebase uid
    const userResult = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [uid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // delete in dependency order inside a transaction so it's all-or-nothing
    await pool.query('BEGIN');

    // junction tables first
    await pool.query(
      'DELETE FROM outfit_items WHERE outfit_id IN (SELECT id FROM outfits WHERE user_id = $1)',
      [userId]
    );

    // post interactions
    await pool.query(
      'DELETE FROM likes WHERE user_id = $1 OR post_id IN (SELECT id FROM scan_posts WHERE user_id = $1)',
      [userId]
    );
    await pool.query(
      'DELETE FROM comments WHERE user_id = $1 OR post_id IN (SELECT id FROM scan_posts WHERE user_id = $1)',
      [userId]
    );

    // messaging
    await pool.query(
      'DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user1_id = $1 OR user2_id = $1)',
      [userId]
    );
    await pool.query(
      'DELETE FROM trade_requests WHERE requester_id = $1 OR recipient_id = $1',
      [userId]
    );
    await pool.query('DELETE FROM conversations WHERE user1_id = $1 OR user2_id = $1', [userId]);

    // wardrobe & outfits
    await pool.query('DELETE FROM outfits WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM wardrobe_items WHERE user_id = $1', [userId]);

    // social posts
    await pool.query('DELETE FROM scan_posts WHERE user_id = $1', [userId]);

    // scans
    await pool.query('DELETE FROM scans WHERE user_id = $1', [userId]);

    // social graph
    await pool.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userId]);

    // gamification
    await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_challenges WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM leaderboard WHERE user_id = $1', [userId]);

    // misc
    await pool.query('DELETE FROM wishlist WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM push_tokens WHERE user_id = $1', [userId]);

    // profile + account
    await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    await pool.query('COMMIT');

    // remove image files from disk
    const userUploadDir = path.join(__dirname, '..', 'uploads', uid);
    if (fs.existsSync(userUploadDir)) {
      fs.rmSync(userUploadDir, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


