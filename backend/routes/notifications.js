// push token registration routes
// stores and removes Expo push tokens for authenticated users

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

// POST /api/notifications/register-token - save push token for current user
router.post('/register-token', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET platform = $3`,
      [userId, token, platform || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/notifications/unregister-token - remove push token on logout
router.delete('/unregister-token', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    await pool.query(
      'DELETE FROM push_tokens WHERE user_id = $1 AND token = $2',
      [userId, token]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
