// author: caitriona mccann
// date: 10/02/2026
// push notification service using expo's push notification api
//
// expo acts as an intermediary to reach both iOS (APNs) and Android (FCM)
// from a single API. each device registers a push token when the app first loads
// (stored in the push_tokens table). a user can have multiple tokens if they
// use the app on more than one device.
//
// invalid/expired tokens (DeviceNotRegistered) are removed from the DB automatically
// after a failed send so they don't accumulate over time.
//
// used by: messaging.js (new message notifications), social.js (like/follow/comment)

const { Expo } = require('expo-server-sdk');
const pool = require('../database/db');

// create a single Expo SDK client instance for all notification sends
const expo = new Expo();

/**
 * Send a push notification to all of a user's registered devices.
 * Fetches all push tokens for the user, validates each one, sends in batches
 * (Expo chunks large arrays to stay within API limits), and removes any tokens
 * that Expo reports as no longer registered.
 *
 * @param {number} userId - internal DB user id (not firebase uid)
 * @param {object} notification - notification payload
 * @param {string} notification.title - notification title shown in the device's notification tray
 * @param {string} notification.body - notification body text (the message preview)
 * @param {object} [notification.data={}] - optional custom data payload sent to the app
 * @returns {Promise<void>} resolves when all chunks have been sent (failures are logged, not thrown)
 */
async function sendPushNotification(userId, { title, body, data = {} }) {
  try {
    // look up all push tokens registered to this user (they may use multiple devices)
    const result = await pool.query(
      'SELECT token FROM push_tokens WHERE user_id = $1',
      [userId]
    );

    // if the user has no registered tokens, there's nothing to send
    if (result.rows.length === 0) return;

    // build the list of valid notification messages — one per device token
    const messages = [];
    for (const row of result.rows) {
      // validate the token format before trying to send
      // invalid tokens were sometimes saved by older app versions or corrupted
      if (!Expo.isExpoPushToken(row.token)) {
        console.warn('Invalid Expo push token, removing:', row.token);
        // delete the invalid token immediately to keep the table clean
        await pool.query('DELETE FROM push_tokens WHERE token = $1', [row.token]);
        continue;  // skip to the next token
      }

      // build the Expo notification message for this device
      messages.push({
        to: row.token,        // Expo push token (ExponentPushToken[...])
        sound: 'default',     // play the device's default notification sound
        title,                // bold title shown at the top of the notification
        body,                 // main notification text
        data,                 // extra data the app can read when the notification is tapped
      });
    }

    // if all tokens were invalid and removed, nothing left to send
    if (messages.length === 0) return;

    // Expo requires sending in chunks — each chunk stays within the API's batch size limit
    const chunks = expo.chunkPushNotifications(messages);

    // send each chunk and inspect receipts for delivery failures
    for (const chunk of chunks) {
      try {
        // sendPushNotificationsAsync sends the batch and returns per-message receipts
        const receipts = await expo.sendPushNotificationsAsync(chunk);

        // iterate receipts in parallel with the chunk to correlate token with result
        for (let i = 0; i < receipts.length; i++) {
          if (receipts[i].status === 'error') {
            const { details } = receipts[i];
            // DeviceNotRegistered means the user uninstalled the app or revoked notification permission
            // delete the token so we don't keep trying to send to it
            if (details?.error === 'DeviceNotRegistered') {
              await pool.query('DELETE FROM push_tokens WHERE token = $1', [chunk[i].to]);
            }
          }
        }
      } catch (err) {
        // log chunk-level errors without crashing — other chunks may still succeed
        console.error('Error sending push notification chunk:', err.message);
      }
    }
  } catch (error) {
    // log outer errors (e.g. DB query failure) — push is non-critical, never throw
    console.error('Push notification error:', error.message);
  }
}

module.exports = { sendPushNotification };
