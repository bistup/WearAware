// author: caitriona mccann
// date: 12/03/2026
// wardrobe routes - manage user's clothing wardrobe
// add items from scans or manually, track wear count, organize by category

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

// ensure available_for column exists (idempotent migration)
pool.query(`ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS available_for VARCHAR(10)`)
  .catch(err => console.error('Migration error (available_for):', err));

// GET /api/wardrobe - get all wardrobe items for current user
router.get('/', async (req, res) => {
  const { firebaseUid, category } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let query = `SELECT * FROM wardrobe_items WHERE user_id = $1`;
    const params = [userId];

    if (category && category !== 'All') {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY is_favorite DESC, updated_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      items: result.rows.map(formatItem),
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching wardrobe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/wardrobe - add item to wardrobe
router.post('/', async (req, res) => {
  const { firebaseUid, scanId, name, brand, itemType, color, size, category, notes, imageUrl, thumbnailUrl, environmentalGrade, environmentalScore, fibers } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // check if scan already in wardrobe
    if (scanId) {
      const existing = await pool.query(
        'SELECT id FROM wardrobe_items WHERE user_id = $1 AND scan_id = $2',
        [userId, scanId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, alreadyExists: true, item: formatItem(existing.rows[0]), error: 'This item is already in your wardrobe' });
      }
    }

    const result = await pool.query(
      `INSERT INTO wardrobe_items (user_id, scan_id, name, brand, item_type, color, size, category, notes, image_url, thumbnail_url, environmental_grade, environmental_score, fibers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        userId, scanId || null, name, brand || null,
        itemType || null, color || null, size || null, category || 'General',
        notes || null, imageUrl || null, thumbnailUrl || null,
        environmentalGrade || null, environmentalScore || null,
        fibers ? JSON.stringify(fibers) : null,
      ]
    );

    res.json({
      success: true,
      item: formatItem(result.rows[0]),
    });
  } catch (error) {
    console.error('Error adding to wardrobe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wardrobe/marketplace - all listed items from other users
router.get('/marketplace', async (req, res) => {
  const { firebaseUid, filter } = req.query;

  try {
    const userId = firebaseUid ? await getUserId(firebaseUid) : null;

    let query = `
      SELECT wi.*, up.display_name, up.avatar_url, u.firebase_uid AS owner_firebase_uid
      FROM wardrobe_items wi
      JOIN users u ON wi.user_id = u.id
      LEFT JOIN user_profiles up ON wi.user_id = up.user_id
      WHERE wi.available_for IS NOT NULL
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND wi.user_id != $${params.length}`;
    }

    if (filter === 'free') {
      query += ` AND wi.available_for IN ('free', 'both')`;
    } else if (filter === 'trade') {
      query += ` AND wi.available_for IN ('trade', 'both')`;
    }

    query += ` ORDER BY wi.updated_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    // also fetch user's own listings so they can see what they've put up
    let myListings = [];
    if (userId) {
      let myQuery = `
        SELECT wi.* FROM wardrobe_items wi
        WHERE wi.user_id = $1 AND wi.available_for IS NOT NULL
      `;
      const myParams = [userId];
      if (filter === 'free') {
        myQuery += ` AND wi.available_for IN ('free', 'both')`;
      } else if (filter === 'trade') {
        myQuery += ` AND wi.available_for IN ('trade', 'both')`;
      }
      myQuery += ` ORDER BY wi.updated_at DESC`;
      const myResult = await pool.query(myQuery, myParams);
      myListings = myResult.rows.map(row => formatItem(row));
    }

    res.json({
      success: true,
      items: result.rows.map(row => ({
        ...formatItem(row),
        ownerName: row.display_name || 'User',
        ownerAvatarUrl: row.avatar_url,
        ownerFirebaseUid: row.owner_firebase_uid,
      })),
      myListings,
    });
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/wardrobe/:id/list - list or unlist an item on the marketplace
router.put('/:id/list', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid, availableFor } = req.body; // 'free', 'trade', 'both', or null to unlist

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `UPDATE wardrobe_items SET available_for = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, availableFor || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, item: formatItem(result.rows[0]) });
  } catch (error) {
    console.error('Error listing item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/wardrobe/:id - update wardrobe item
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid, name, brand, itemType, color, size, category, notes, isFavorite } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `UPDATE wardrobe_items
       SET name = COALESCE($3, name),
           brand = COALESCE($4, brand),
           item_type = COALESCE($5, item_type),
           color = COALESCE($6, color),
           size = COALESCE($7, size),
           category = COALESCE($8, category),
           notes = COALESCE($9, notes),
           is_favorite = COALESCE($10, is_favorite),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, name, brand, itemType, color, size, category, notes, isFavorite]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, item: formatItem(result.rows[0]) });
  } catch (error) {
    console.error('Error updating wardrobe item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/wardrobe/:id/wear - log a wear
router.post('/:id/wear', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `UPDATE wardrobe_items
       SET wear_count = wear_count + 1, last_worn = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, item: formatItem(result.rows[0]) });
  } catch (error) {
    console.error('Error logging wear:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/wardrobe/:id - remove from wardrobe
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      'DELETE FROM wardrobe_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from wardrobe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/wardrobe/import-scans - bulk import scans not already in wardrobe
router.post('/import-scans', async (req, res) => {
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // find scans that aren't already in wardrobe
    const result = await pool.query(
      `INSERT INTO wardrobe_items (user_id, scan_id, name, brand, item_type, image_url, thumbnail_url, environmental_grade, environmental_score, fibers, category)
       SELECT s.user_id, s.id,
         COALESCE(NULLIF(s.brand, '') || ' ' || COALESCE(NULLIF(s.item_type, ''), 'Item'), COALESCE(NULLIF(s.item_type, ''), 'Scanned Item')),
         s.brand, s.item_type, s.image_url, s.thumbnail_url,
         s.environmental_grade, s.environmental_score, s.fibers,
         CASE LOWER(s.item_type)
           WHEN 'shirt'    THEN 'Tops'
           WHEN 't-shirt'  THEN 'Tops'
           WHEN 'blouse'   THEN 'Tops'
           WHEN 'sweater'  THEN 'Tops'
           WHEN 'hoodie'   THEN 'Tops'
           WHEN 'jacket'   THEN 'Outerwear'
           WHEN 'coat'     THEN 'Outerwear'
           WHEN 'jeans'    THEN 'Bottoms'
           WHEN 'pants'    THEN 'Bottoms'
           WHEN 'shorts'   THEN 'Bottoms'
           WHEN 'skirt'    THEN 'Bottoms'
           WHEN 'dress'    THEN 'Dresses'
           WHEN 'scarf'    THEN 'Accessories'
           ELSE 'General'
         END
       FROM scans s
       WHERE s.user_id = $1
         AND s.id NOT IN (SELECT scan_id FROM wardrobe_items WHERE user_id = $1 AND scan_id IS NOT NULL)
       RETURNING *`,
      [userId]
    );

    res.json({
      success: true,
      imported: result.rows.length,
      items: result.rows.map(formatItem),
    });
  } catch (error) {
    console.error('Error importing scans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wardrobe/categories - get user's categories
router.get('/categories', async (req, res) => {
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM wardrobe_items WHERE user_id = $1
       GROUP BY category ORDER BY count DESC`,
      [userId]
    );

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function formatItem(row) {
  return {
    id: row.id,
    scanId: row.scan_id,
    name: row.name,
    brand: row.brand,
    itemType: row.item_type,
    color: row.color,
    size: row.size,
    category: row.category,
    notes: row.notes,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
environmentalGrade: row.environmental_grade,
    environmentalScore: row.environmental_score,
    fibers: row.fibers,
    isFavorite: row.is_favorite,
    wearCount: row.wear_count,
    lastWorn: row.last_worn,
    availableFor: row.available_for,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
