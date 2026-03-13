// author: caitriona mccann
// date: 12/03/2026
// outfits routes - create and manage outfits from wardrobe items
// assign outfits to days of the week for weekly planning

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

// GET /api/outfits - get all outfits (optionally filter by day)
router.get('/', async (req, res) => {
  const { firebaseUid, day } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let query = `SELECT o.*,
      COALESCE(json_agg(
        json_build_object(
          'id', oi.id,
          'wardrobeItemId', wi.id,
          'name', wi.name,
          'brand', wi.brand,
          'category', wi.category,
          'imageUrl', wi.image_url,
          'thumbnailUrl', wi.thumbnail_url,
          'environmentalGrade', wi.environmental_grade,
          'position', oi.position
        ) ORDER BY oi.position
      ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
      FROM outfits o
      LEFT JOIN outfit_items oi ON o.id = oi.outfit_id
      LEFT JOIN wardrobe_items wi ON oi.wardrobe_item_id = wi.id
      WHERE o.user_id = $1`;

    const params = [userId];

    if (day) {
      query += ` AND o.day_of_week = $2`;
      params.push(day);
    }

    query += ` GROUP BY o.id ORDER BY o.updated_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      outfits: result.rows.map(formatOutfit),
    });
  } catch (error) {
    console.error('Error fetching outfits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/outfits/weekly - get outfits organized by day of week
router.get('/weekly', async (req, res) => {
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT o.*,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'wardrobeItemId', wi.id,
            'name', wi.name,
            'brand', wi.brand,
            'category', wi.category,
            'imageUrl', wi.image_url,
            'thumbnailUrl', wi.thumbnail_url,
            'environmentalGrade', wi.environmental_grade,
            'position', oi.position
          ) ORDER BY oi.position
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM outfits o
        LEFT JOIN outfit_items oi ON o.id = oi.outfit_id
        LEFT JOIN wardrobe_items wi ON oi.wardrobe_item_id = wi.id
        WHERE o.user_id = $1 AND o.day_of_week IS NOT NULL
        GROUP BY o.id
        ORDER BY CASE o.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
          ELSE 8
        END`,
      [userId]
    );

    // group by day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekly = {};
    for (const day of days) {
      weekly[day] = [];
    }
    for (const row of result.rows) {
      if (row.day_of_week && weekly[row.day_of_week]) {
        weekly[row.day_of_week].push(formatOutfit(row));
      }
    }

    res.json({ success: true, weekly });
  } catch (error) {
    console.error('Error fetching weekly outfits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/outfits - create outfit
router.post('/', async (req, res) => {
  const { firebaseUid, name, dayOfWeek, notes, itemIds } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Outfit name is required' });
    }

    // create the outfit
    const outfitResult = await pool.query(
      `INSERT INTO outfits (user_id, name, day_of_week, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name.trim(), dayOfWeek || null, notes || null]
    );

    const outfitId = outfitResult.rows[0].id;

    // add items if provided
    if (itemIds && itemIds.length > 0) {
      const values = itemIds.map((itemId, idx) =>
        `(${outfitId}, ${parseInt(itemId)}, ${idx})`
      ).join(', ');

      await pool.query(
        `INSERT INTO outfit_items (outfit_id, wardrobe_item_id, position)
         VALUES ${values}`
      );
    }

    // fetch the complete outfit with items
    const result = await pool.query(
      `SELECT o.*,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'wardrobeItemId', wi.id,
            'name', wi.name,
            'brand', wi.brand,
            'category', wi.category,
            'imageUrl', wi.image_url,
            'thumbnailUrl', wi.thumbnail_url,
            'environmentalGrade', wi.environmental_grade,
            'position', oi.position
          ) ORDER BY oi.position
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM outfits o
        LEFT JOIN outfit_items oi ON o.id = oi.outfit_id
        LEFT JOIN wardrobe_items wi ON oi.wardrobe_item_id = wi.id
        WHERE o.id = $1
        GROUP BY o.id`,
      [outfitId]
    );

    res.json({ success: true, outfit: formatOutfit(result.rows[0]) });
  } catch (error) {
    console.error('Error creating outfit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/outfits/:id - update outfit (name, day, notes, items)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid, name, dayOfWeek, notes, itemIds } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // verify ownership
    const check = await pool.query(
      'SELECT id FROM outfits WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Outfit not found' });
    }

    // update outfit details
    await pool.query(
      `UPDATE outfits SET
        name = COALESCE($3, name),
        day_of_week = $4,
        notes = COALESCE($5, notes),
        updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId, name, dayOfWeek !== undefined ? dayOfWeek : undefined, notes]
    );

    // replace items if provided
    if (itemIds !== undefined) {
      await pool.query('DELETE FROM outfit_items WHERE outfit_id = $1', [id]);

      if (itemIds.length > 0) {
        const values = itemIds.map((itemId, idx) =>
          `(${parseInt(id)}, ${parseInt(itemId)}, ${idx})`
        ).join(', ');

        await pool.query(
          `INSERT INTO outfit_items (outfit_id, wardrobe_item_id, position)
           VALUES ${values}`
        );
      }
    }

    // fetch updated outfit
    const result = await pool.query(
      `SELECT o.*,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'wardrobeItemId', wi.id,
            'name', wi.name,
            'brand', wi.brand,
            'category', wi.category,
            'imageUrl', wi.image_url,
            'thumbnailUrl', wi.thumbnail_url,
            'environmentalGrade', wi.environmental_grade,
            'position', oi.position
          ) ORDER BY oi.position
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM outfits o
        LEFT JOIN outfit_items oi ON o.id = oi.outfit_id
        LEFT JOIN wardrobe_items wi ON oi.wardrobe_item_id = wi.id
        WHERE o.id = $1
        GROUP BY o.id`,
      [id]
    );

    res.json({ success: true, outfit: formatOutfit(result.rows[0]) });
  } catch (error) {
    console.error('Error updating outfit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/outfits/:id - delete outfit
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      'DELETE FROM outfits WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Outfit not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting outfit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function formatOutfit(row) {
  return {
    id: row.id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    notes: row.notes,
    items: row.items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
