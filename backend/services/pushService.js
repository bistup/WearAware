// push notification service using Expo's push API
// sends notifications to users' devices via their stored Expo push tokens

const { Expo } = require('expo-server-sdk');
const pool = require('../database/db');

const expo = new Expo();

/**
 * Send a push notification to all of a user's registered devices
 * @param {number} userId - internal DB user ID
 * @param {object} notification - { title, body, data }
 */
async function sendPushNotification(userId, { title, body, data = {} }) {
  try {
    const result = await pool.query(
      'SELECT token FROM push_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) return;

    const messages = [];
    for (const row of result.rows) {
      if (!Expo.isExpoPushToken(row.token)) {
        console.warn('Invalid Expo push token, removing:', row.token);
        await pool.query('DELETE FROM push_tokens WHERE token = $1', [row.token]);
        continue;
      }

      messages.push({
        to: row.token,
        sound: 'default',
        title,
        body,
        data,
      });
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        // handle failed tokens
        for (let i = 0; i < receipts.length; i++) {
          if (receipts[i].status === 'error') {
            const { details } = receipts[i];
            if (details?.error === 'DeviceNotRegistered') {
              await pool.query('DELETE FROM push_tokens WHERE token = $1', [chunk[i].to]);
            }
          }
        }
      } catch (err) {
        console.error('Error sending push notification chunk:', err.message);
      }
    }
  } catch (error) {
    console.error('Push notification error:', error.message);
  }
}

module.exports = { sendPushNotification };
