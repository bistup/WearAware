// author: caitriona mccann
// date: 09/02/2026
// alternatives routes - product recommendations, wishlist, comparison
// helps users find better sustainable alternatives to low-grade items

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');
const cache = require('../cache');

// --- product recommendations

// GET /api/alternatives/recommendations - get alternatives for an item type
router.get('/recommendations', async (req, res) => {
  const { itemType, currentGrade, currentScore, limit: queryLimit } = req.query;
  const limit = parseInt(queryLimit) || 10;

  try {
    // try cache first
    const cacheKey = `recommendations:${(itemType || 'all').toLowerCase()}`;
    const cached = await cache.getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, recommendations: cached, cached: true });
    }

    let query;
    let params;

    if (itemType) {
      // get recommendations for specific item type that are better than current grade
      const scoreThreshold = parseInt(currentScore) || 0;
      query = `
        SELECT * FROM product_recommendations 
        WHERE LOWER(item_type) = LOWER($1)
          AND sustainability_score > $2
        ORDER BY sustainability_score DESC
        LIMIT $3`;
      params = [itemType, scoreThreshold, limit];
    } else {
      // get top recommendations across all types
      query = `
        SELECT * FROM product_recommendations 
        ORDER BY sustainability_score DESC
        LIMIT $1`;
      params = [limit];
    }

    const result = await pool.query(query, params);

    const recommendations = result.rows.map(row => ({
      id: row.id,
      itemType: row.item_type,
      brand: row.brand,
      productName: row.product_name,
      price: parseFloat(row.price_usd),
      grade: row.sustainability_grade,
      score: row.sustainability_score,
      waterUsage: parseFloat(row.water_usage_liters),
      carbonFootprint: parseFloat(row.carbon_footprint_kg),
      primaryFiber: row.primary_fiber,
      externalUrl: row.external_url,
      imageUrl: row.image_url,
    }));

    // cache for 1 hour
    await cache.setCached(cacheKey, recommendations, 3600);

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alternatives/compare - compare scanned item vs recommendation
router.get('/compare', async (req, res) => {
  const { scanId, recommendationId, firebaseUid } = req.query;

  try {
    // fetch scan data
    const scan = await pool.query(
      'SELECT * FROM scans WHERE id = $1 AND firebase_uid = $2',
      [scanId, firebaseUid]
    );

    if (scan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scan not found' });
    }

    // fetch recommendation
    const rec = await pool.query(
      'SELECT * FROM product_recommendations WHERE id = $1',
      [recommendationId]
    );

    if (rec.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recommendation not found' });
    }

    const scanData = scan.rows[0];
    const recData = rec.rows[0];

    const waterSaved = parseFloat(scanData.water_usage_liters) - parseFloat(recData.water_usage_liters);
    const carbonSaved = parseFloat(scanData.carbon_footprint_kg) - parseFloat(recData.carbon_footprint_kg);

    res.json({
      success: true,
      comparison: {
        scannedItem: {
          brand: scanData.brand,
          itemType: scanData.item_type,
          grade: scanData.environmental_grade,
          score: scanData.environmental_score,
          waterUsage: parseFloat(scanData.water_usage_liters),
          carbonFootprint: parseFloat(scanData.carbon_footprint_kg),
          fibers: scanData.fibers,
        },
        alternative: {
          brand: recData.brand,
          productName: recData.product_name,
          price: parseFloat(recData.price_usd),
          grade: recData.sustainability_grade,
          score: recData.sustainability_score,
          waterUsage: parseFloat(recData.water_usage_liters),
          carbonFootprint: parseFloat(recData.carbon_footprint_kg),
          primaryFiber: recData.primary_fiber,
          externalUrl: recData.external_url,
        },
        savings: {
          waterLiters: Math.max(0, waterSaved),
          carbonKg: Math.max(0, carbonSaved),
          scoreImprovement: recData.sustainability_score - scanData.environmental_score,
        },
      },
    });
  } catch (error) {
    console.error('Error comparing items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- wishlist

// GET /api/alternatives/wishlist - get user's wishlist
router.get('/wishlist', async (req, res) => {
  const { firebaseUid } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT w.id as wishlist_id, w.notes, w.created_at as added_at,
              pr.*
       FROM wishlist w
       JOIN product_recommendations pr ON pr.id = w.recommendation_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const total = await pool.query(
      'SELECT COUNT(*) FROM wishlist WHERE user_id = $1',
      [userId]
    );

    const items = result.rows.map(row => ({
      wishlistId: row.wishlist_id,
      notes: row.notes,
      addedAt: row.added_at,
      recommendation: {
        id: row.id,
        itemType: row.item_type,
        brand: row.brand,
        productName: row.product_name,
        price: parseFloat(row.price_usd),
        grade: row.sustainability_grade,
        score: row.sustainability_score,
        waterUsage: parseFloat(row.water_usage_liters),
        carbonFootprint: parseFloat(row.carbon_footprint_kg),
        primaryFiber: row.primary_fiber,
        externalUrl: row.external_url,
      },
    }));

    res.json({
      success: true,
      wishlist: items,
      total: parseInt(total.rows[0].count),
      page,
      hasMore: offset + limit < parseInt(total.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/alternatives/wishlist - add to wishlist
router.post('/wishlist', async (req, res) => {
  const { firebaseUid, recommendationId, notes } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO wishlist (user_id, recommendation_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, recommendation_id) DO UPDATE SET notes = $3`,
      [userId, recommendationId, notes || null]
    );

    res.json({ success: true, message: 'Added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    if (error.code === '23505') {
      return res.json({ success: true, message: 'Already in wishlist' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/alternatives/wishlist/:wishlistId - remove from wishlist
router.delete('/wishlist/:wishlistId', async (req, res) => {
  const { wishlistId } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      'DELETE FROM wishlist WHERE id = $1 AND user_id = $2 RETURNING id',
      [wishlistId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wishlist item not found' });
    }

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
