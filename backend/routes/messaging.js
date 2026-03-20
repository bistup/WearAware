// author: caitriona mccann
// date: 18/03/2026
// messaging and trade routes - conversations, messages, trade requests with charity shop dropbox

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// helper: get or create a conversation between two users
async function getOrCreateConversation(userId1, userId2) {
  const low = Math.min(userId1, userId2);
  const high = Math.max(userId1, userId2);

  // try to find existing
  let result = await pool.query(
    'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2',
    [low, high]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  // create new
  result = await pool.query(
    'INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING id',
    [low, high]
  );
  return result.rows[0].id;
}

// helper: generate a random 6-digit PIN
function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// helper: haversine midpoint between two coordinates
function getMidpoint(lat1, lng1, lat2, lng2) {
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const rlat1 = toRad(lat1);
  const rlat2 = toRad(lat2);
  const rlng1 = toRad(lng1);
  const bx = Math.cos(rlat2) * Math.cos(dLng);
  const by = Math.cos(rlat2) * Math.sin(dLng);
  const midLat = toDeg(Math.atan2(
    Math.sin(rlat1) + Math.sin(rlat2),
    Math.sqrt((Math.cos(rlat1) + bx) ** 2 + by ** 2)
  ));
  const midLng = toDeg(rlng1 + Math.atan2(by, Math.cos(rlat1) + bx));
  return { lat: midLat, lng: midLng };
}

// helper: haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// known charity shop names (same as charityShops.js)
const CHARITY_SHOP_NAMES = [
  'st vincent de paul', 'svp', 'vincent', 'vincents', 'oxfam',
  'enable ireland', 'vision ireland', 'ncbi', 'barnardos',
  'irish cancer society', 'irish heart foundation', 'trocaire',
  'dublin simon', 'simon community', 'concern', 'goal',
  'irish wheelchair association', 'irish red cross', 'debra ireland',
  'british heart foundation', 'bhf', 'british red cross',
  'cancer research', 'cancer focus', 'age uk', 'marie curie',
  'hospice', 'action cancer', 'sue ryder', 'salvation army',
  'save the children', 'macmillan', 'mencap',
  'charity shop', 'thrift', 'second hand', 'secondhand',
  'vintage', 'preloved', 'goodwill',
];

function isCharityShop(placeName, placeTypes) {
  const nameLower = placeName.toLowerCase();
  for (const charity of CHARITY_SHOP_NAMES) {
    if (nameLower.includes(charity)) return true;
  }
  const charityTypes = ['thrift_store', 'second_hand_store', 'used_clothing_store', 'donation_center'];
  if (placeTypes && placeTypes.some(t => charityTypes.includes(t))) return true;
  return false;
}

// find nearest charity shop to a given point
async function findNearestCharityShop(lat, lng) {
  const keywords = ['charity shop', 'thrift store', 'Oxfam', 'St Vincent de Paul'];
  const allPlaces = [];
  const seenIds = new Set();

  for (const keyword of keywords) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types',
        },
        body: JSON.stringify({
          textQuery: keyword,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 15000,
            },
          },
          maxResultCount: 10,
        }),
      });
      const data = await response.json();
      if (data.places) {
        for (const place of data.places) {
          if (!seenIds.has(place.id)) {
            const name = place.displayName?.text || 'Unknown';
            if (isCharityShop(name, place.types || [])) {
              seenIds.add(place.id);
              allPlaces.push({
                name,
                address: place.formattedAddress || '',
                lat: place.location?.latitude,
                lng: place.location?.longitude,
                rating: place.rating || null,
                distance: getDistance(lat, lng, place.location?.latitude, place.location?.longitude),
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Places API error for keyword:', keyword, err.message);
    }
  }

  allPlaces.sort((a, b) => a.distance - b.distance);
  return allPlaces.length > 0 ? allPlaces[0] : null;
}

// ============================================================
// CONVERSATIONS
// ============================================================

// GET /api/messaging/conversations - list all conversations for the current user
router.get('/conversations', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const result = await pool.query(`
      SELECT c.id, c.last_message_at, c.created_at,
        CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END AS other_user_id,
        u.firebase_uid AS other_firebase_uid,
        COALESCE(up.display_name, u.email) AS other_display_name,
        up.avatar_url AS other_avatar_url,
        m.content AS last_message,
        m.message_type AS last_message_type,
        m.sender_id AS last_message_sender_id,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = FALSE) AS unread_count
      FROM conversations c
      JOIN users u ON u.id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT content, message_type, sender_id FROM messages
        WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
      ) m ON TRUE
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC
    `, [userId]);

    res.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/messaging/conversations - start a new conversation (or return existing)
router.post('/conversations', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const { targetFirebaseUid } = req.body;
    const targetUserId = await getUserId(targetFirebaseUid);
    if (!targetUserId) return res.status(404).json({ success: false, error: 'Target user not found' });

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, error: 'Cannot message yourself' });
    }

    const conversationId = await getOrCreateConversation(userId, targetUserId);
    res.json({ success: true, conversationId });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// MESSAGES
// ============================================================

// GET /api/messaging/conversations/:id/messages - get messages in a conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const conversationId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    // verify user is part of this conversation
    const conv = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    if (conv.rows.length === 0) return res.status(403).json({ success: false, error: 'Not your conversation' });

    // mark messages as read
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE',
      [conversationId, userId]
    );

    const result = await pool.query(`
      SELECT m.id, m.sender_id, m.content, m.message_type, m.trade_request_id, m.is_read, m.created_at,
        u.firebase_uid AS sender_firebase_uid,
        COALESCE(up.display_name, u.email) AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);

    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/messaging/conversations/:id/messages - send a message
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const conversationId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content required' });
    }

    // verify user is part of this conversation
    const conv = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    if (conv.rows.length === 0) return res.status(403).json({ success: false, error: 'Not your conversation' });

    const result = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [conversationId, userId, content.trim(), 'text']
    );

    // update conversation timestamp
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);

    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/messaging/unread-count - total unread messages across all conversations
router.get('/unread-count', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.json({ success: true, count: 0 });

    const result = await pool.query(`
      SELECT COUNT(*) AS count FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
        AND m.sender_id != $1
        AND m.is_read = FALSE
    `, [userId]);

    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.json({ success: true, count: 0 });
  }
});

// ============================================================
// TRADE REQUESTS
// ============================================================

// POST /api/messaging/trade-request - create a trade request
router.post('/trade-request', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const { targetFirebaseUid, offeredItemId, wantedItemId, tradeType, lat, lng } = req.body;

    const targetUserId = await getUserId(targetFirebaseUid);
    if (!targetUserId) return res.status(404).json({ success: false, error: 'Target user not found' });

    // verify offered item belongs to requester
    const offeredCheck = await pool.query(
      'SELECT id FROM wardrobe_items WHERE id = $1 AND user_id = $2',
      [offeredItemId, userId]
    );
    if (offeredCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Offered item not found in your wardrobe' });
    }

    // if trade type, verify wanted item belongs to target
    if (tradeType === 'trade' && wantedItemId) {
      const wantedCheck = await pool.query(
        'SELECT id FROM wardrobe_items WHERE id = $1 AND user_id = $2',
        [wantedItemId, targetUserId]
      );
      if (wantedCheck.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Wanted item not found in their wardrobe' });
      }
    }

    // get or create conversation
    const conversationId = await getOrCreateConversation(userId, targetUserId);

    // create trade request
    const trade = await pool.query(`
      INSERT INTO trade_requests
        (conversation_id, requester_id, recipient_id, offered_item_id, wanted_item_id, trade_type, requester_lat, requester_lng)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [conversationId, userId, targetUserId, offeredItemId, wantedItemId || null, tradeType || 'free', lat || null, lng || null]);

    // create a system message in the conversation
    const tradeLabel = tradeType === 'free' ? 'offered an item for free' : 'proposed a trade';
    await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, content, message_type, trade_request_id) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, userId, tradeLabel, 'trade_request', trade.rows[0].id]
    );
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);

    res.json({ success: true, tradeRequest: trade.rows[0], conversationId });
  } catch (error) {
    console.error('Error creating trade request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/messaging/trade-request/:id - get trade request details
router.get('/trade-request/:id', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const result = await pool.query(`
      SELECT tr.*,
        oi.name AS offered_item_name, oi.brand AS offered_item_brand,
        oi.image_url AS offered_item_image, oi.thumbnail_url AS offered_item_thumbnail,
        oi.environmental_grade AS offered_item_grade,
        wi.name AS wanted_item_name, wi.brand AS wanted_item_brand,
        wi.image_url AS wanted_item_image, wi.thumbnail_url AS wanted_item_thumbnail,
        wi.environmental_grade AS wanted_item_grade,
        ru.firebase_uid AS requester_firebase_uid,
        COALESCE(rp.display_name, ru.email) AS requester_name,
        tu.firebase_uid AS recipient_firebase_uid,
        COALESCE(tp.display_name, tu.email) AS recipient_name
      FROM trade_requests tr
      JOIN wardrobe_items oi ON oi.id = tr.offered_item_id
      LEFT JOIN wardrobe_items wi ON wi.id = tr.wanted_item_id
      JOIN users ru ON ru.id = tr.requester_id
      LEFT JOIN user_profiles rp ON rp.user_id = ru.id
      JOIN users tu ON tu.id = tr.recipient_id
      LEFT JOIN user_profiles tp ON tp.user_id = tu.id
      WHERE tr.id = $1 AND (tr.requester_id = $2 OR tr.recipient_id = $2)
    `, [parseInt(req.params.id), userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trade request not found' });
    }

    res.json({ success: true, tradeRequest: result.rows[0] });
  } catch (error) {
    console.error('Error fetching trade request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/messaging/trade-request/:id/respond - accept or decline a trade
router.put('/trade-request/:id/respond', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const tradeId = parseInt(req.params.id);
    const { action, lat, lng } = req.body; // action: 'accept' or 'decline'

    // get the trade request
    const trade = await pool.query(
      'SELECT * FROM trade_requests WHERE id = $1 AND recipient_id = $2 AND status = $3',
      [tradeId, userId, 'pending']
    );
    if (trade.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pending trade request not found' });
    }

    const tr = trade.rows[0];

    if (action === 'decline') {
      await pool.query(
        'UPDATE trade_requests SET status = $1, updated_at = NOW() WHERE id = $2',
        ['declined', tradeId]
      );
      // system message
      await pool.query(
        'INSERT INTO messages (conversation_id, sender_id, content, message_type, trade_request_id) VALUES ($1, $2, $3, $4, $5)',
        [tr.conversation_id, userId, 'declined the trade request', 'trade_update', tradeId]
      );
      await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [tr.conversation_id]);

      return res.json({ success: true, status: 'declined' });
    }

    if (action === 'accept') {
      // calculate midpoint between both users
      const reqLat = tr.requester_lat;
      const reqLng = tr.requester_lng;
      const recLat = lat || null;
      const recLng = lng || null;

      let charityShop = null;
      let requesterPin = generatePin();
      let recipientPin = generatePin();
      let requesterCompartment = 1;
      let recipientCompartment = 2;

      if (reqLat && reqLng && recLat && recLng) {
        // find midpoint and search for nearest charity shop
        const midpoint = getMidpoint(reqLat, reqLng, recLat, recLng);
        charityShop = await findNearestCharityShop(midpoint.lat, midpoint.lng);
      } else if (reqLat && reqLng) {
        charityShop = await findNearestCharityShop(reqLat, reqLng);
      } else if (recLat && recLng) {
        charityShop = await findNearestCharityShop(recLat, recLng);
      }

      await pool.query(`
        UPDATE trade_requests SET
          status = 'accepted',
          recipient_lat = $1, recipient_lng = $2,
          charity_shop_name = $3, charity_shop_address = $4,
          charity_shop_lat = $5, charity_shop_lng = $6,
          requester_pin = $7, recipient_pin = $8,
          requester_compartment = $9, recipient_compartment = $10,
          accepted_at = NOW(), updated_at = NOW()
        WHERE id = $11
      `, [
        recLat, recLng,
        charityShop?.name || null, charityShop?.address || null,
        charityShop?.lat || null, charityShop?.lng || null,
        requesterPin, recipientPin,
        requesterCompartment, recipientCompartment,
        tradeId
      ]);

      // system message
      await pool.query(
        'INSERT INTO messages (conversation_id, sender_id, content, message_type, trade_request_id) VALUES ($1, $2, $3, $4, $5)',
        [tr.conversation_id, userId, 'accepted the trade! Check the trade details for your dropbox PIN.', 'trade_update', tradeId]
      );
      await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [tr.conversation_id]);

      // fetch updated trade
      const updated = await pool.query('SELECT * FROM trade_requests WHERE id = $1', [tradeId]);

      return res.json({ success: true, status: 'accepted', tradeRequest: updated.rows[0] });
    }

    res.status(400).json({ success: false, error: 'Invalid action. Use accept or decline.' });
  } catch (error) {
    console.error('Error responding to trade:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/messaging/trade-request/:id/update-shop - change the charity shop for a trade
router.put('/trade-request/:id/update-shop', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const tradeId = parseInt(req.params.id);
    const { shopName, shopAddress, shopLat, shopLng } = req.body;

    // verify user is part of this trade and it's accepted
    const trade = await pool.query(
      'SELECT * FROM trade_requests WHERE id = $1 AND status = $2 AND (requester_id = $3 OR recipient_id = $3)',
      [tradeId, 'accepted', userId]
    );
    if (trade.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Accepted trade not found' });
    }

    await pool.query(`
      UPDATE trade_requests SET
        charity_shop_name = $1, charity_shop_address = $2,
        charity_shop_lat = $3, charity_shop_lng = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [shopName, shopAddress, shopLat, shopLng, tradeId]);

    // notify in chat
    await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, content, message_type, trade_request_id) VALUES ($1, $2, $3, $4, $5)',
      [trade.rows[0].conversation_id, userId, `changed the meetup location to ${shopName}`, 'trade_update', tradeId]
    );
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [trade.rows[0].conversation_id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating trade shop:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/messaging/trade-request/:id/complete - mark trade as completed
router.put('/trade-request/:id/complete', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const tradeId = parseInt(req.params.id);

    const trade = await pool.query(
      'SELECT * FROM trade_requests WHERE id = $1 AND status = $2 AND (requester_id = $3 OR recipient_id = $3)',
      [tradeId, 'accepted', userId]
    );
    if (trade.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Accepted trade not found' });
    }

    await pool.query(
      'UPDATE trade_requests SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['completed', tradeId]
    );

    await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, content, message_type, trade_request_id) VALUES ($1, $2, $3, $4, $5)',
      [trade.rows[0].conversation_id, userId, 'marked the trade as completed!', 'trade_update', tradeId]
    );
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [trade.rows[0].conversation_id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing trade:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/messaging/trade-requests - list all trade requests for the user
router.get('/trade-requests', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.json({ success: true, trades: [] });

    const result = await pool.query(`
      SELECT tr.*,
        oi.name AS offered_item_name, oi.brand AS offered_item_brand,
        oi.thumbnail_url AS offered_item_thumbnail, oi.environmental_grade AS offered_item_grade,
        wi.name AS wanted_item_name, wi.brand AS wanted_item_brand,
        wi.thumbnail_url AS wanted_item_thumbnail, wi.environmental_grade AS wanted_item_grade,
        COALESCE(rp.display_name, ru.email) AS requester_name,
        COALESCE(tp.display_name, tu.email) AS recipient_name
      FROM trade_requests tr
      JOIN wardrobe_items oi ON oi.id = tr.offered_item_id
      LEFT JOIN wardrobe_items wi ON wi.id = tr.wanted_item_id
      JOIN users ru ON ru.id = tr.requester_id
      LEFT JOIN user_profiles rp ON rp.user_id = ru.id
      JOIN users tu ON tu.id = tr.recipient_id
      LEFT JOIN user_profiles tp ON tp.user_id = tu.id
      WHERE tr.requester_id = $1 OR tr.recipient_id = $1
      ORDER BY tr.updated_at DESC
    `, [userId]);

    res.json({ success: true, trades: result.rows });
  } catch (error) {
    console.error('Error fetching trade requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/messaging/nearby-shops - find charity shops near a midpoint (for changing shop)
router.get('/nearby-shops', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'lat and lng required' });

    const keywords = ['charity shop', 'thrift store', 'Oxfam', 'St Vincent de Paul'];
    const allPlaces = [];
    const seenIds = new Set();

    for (const keyword of keywords) {
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types',
          },
          body: JSON.stringify({
            textQuery: keyword,
            locationBias: { circle: { center: { latitude: parseFloat(lat), longitude: parseFloat(lng) }, radius: 20000 } },
            maxResultCount: 10,
          }),
        });
        const data = await response.json();
        if (data.places) {
          for (const place of data.places) {
            if (!seenIds.has(place.id)) {
              const name = place.displayName?.text || 'Unknown';
              if (isCharityShop(name, place.types || [])) {
                seenIds.add(place.id);
                allPlaces.push({
                  name,
                  address: place.formattedAddress || '',
                  lat: place.location?.latitude,
                  lng: place.location?.longitude,
                  rating: place.rating || null,
                  distance: getDistance(parseFloat(lat), parseFloat(lng), place.location?.latitude, place.location?.longitude),
                });
              }
            }
          }
        }
      } catch (err) { /* skip keyword on error */ }
    }

    allPlaces.sort((a, b) => a.distance - b.distance);
    res.json({ success: true, shops: allPlaces.slice(0, 10) });
  } catch (error) {
    console.error('Error fetching nearby shops:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
