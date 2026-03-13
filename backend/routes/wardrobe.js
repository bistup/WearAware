// author: caitriona mccann
// date: 12/03/2026
// wardrobe routes - manage user's clothing wardrobe
// add items from scans or manually, track wear count, organize by category

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

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
        return res.status(409).json({ success: false, error: 'This item is already in your wardrobe' });
      }
    }

    const result = await pool.query(
      `INSERT INTO wardrobe_items (user_id, scan_id, name, brand, item_type, color, size, category, notes, image_url, thumbnail_url, environmental_grade, environmental_score, fibers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [userId, scanId || null, name, brand || null, itemType || null, color || null, size || null, category || 'General', notes || null, imageUrl || null, thumbnailUrl || null, environmentalGrade || null, environmentalScore || null, fibers ? JSON.stringify(fibers) : null]
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
         s.environmental_grade, s.environmental_score, s.fibers, 'General'
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
