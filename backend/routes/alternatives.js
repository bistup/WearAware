// author: caitriona mccann
// date: 09/02/2026
// alternatives routes - product recommendations, wishlist, comparison
// helps users find better sustainable alternatives to low-grade items

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');
const cache = require('../cache');
const webSearch = require('../services/webSearchService');
const ebayService = require('../services/ebayService');

// --- product recommendations

// GET /api/alternatives/recommendations - get alternatives for an item type
router.get('/recommendations', async (req, res) => {
  const { itemType, limit: queryLimit } = req.query;
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
      // get sustainable alternatives for this item type
      query = `
        SELECT * FROM product_recommendations
        WHERE LOWER(item_type) = LOWER($1)
        ORDER BY sustainability_score DESC
        LIMIT $2`;
      params = [itemType, limit];
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

// --- web search for real products

// GET /api/alternatives/search - search the web for sustainable alternatives
router.get('/search', async (req, res) => {
  const { itemType, primaryFiber, imageUrl, gender, limit: queryLimit } = req.query;
  const limit = parseInt(queryLimit) || 8;

  if (!webSearch.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Web search not configured. Set GOOGLE_APPLICATION_CREDENTIALS on the server.',
      results: [],
    });
  }

  try {
    // check cache first (cache by item type + fiber + gender + image presence)
    const imageHash = imageUrl ? require('crypto').createHash('md5').update(imageUrl).digest('hex').slice(0, 8) : 'noimg';
    const cacheKey = `websearch:${(gender || 'all')}:${(itemType || 'all').toLowerCase()}:${(primaryFiber || 'any').toLowerCase()}:${imageHash}`;
    const cached = await cache.getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, results: cached, cached: true });
    }

    const searchResult = await webSearch.searchAlternatives(itemType, primaryFiber, { limit, imageUrl, gender });

    if (!searchResult.success) {
      return res.status(500).json({
        success: false,
        error: searchResult.error,
        results: [],
      });
    }

    // cache for 24 hours (web results don't change that often)
    if (searchResult.results.length > 0) {
      await cache.setCached(cacheKey, searchResult.results, 86400);
    }

    res.json({
      success: true,
      results: searchResult.results,
      query: searchResult.query,
      totalResults: searchResult.totalResults,
    });
  } catch (error) {
    console.error('Web search endpoint error:', error);
    res.status(500).json({ success: false, error: error.message, results: [] });
  }
});

// --- ebay second-hand search

// GET /api/alternatives/secondhand - search ebay for pre-owned clothing
router.get('/secondhand', async (req, res) => {
  const { itemType, primaryFiber, imageUrl, gender, limit: queryLimit } = req.query;
  const limit = parseInt(queryLimit) || 10;

  if (!ebayService.isConfigured()) {
    return res.json({
      success: true,
      results: [],
      notConfigured: true,
      message: 'eBay integration not configured. Set EBAY_APP_ID and EBAY_CERT_ID on the server.',
    });
  }

  try {
    // check cache first
    const imageHash = imageUrl
      ? require('crypto').createHash('md5').update(imageUrl).digest('hex').slice(0, 8)
      : 'noimg';
    const cacheKey = `ebay:${(gender || 'all')}:${(itemType || 'all').toLowerCase()}:${(primaryFiber || 'any').toLowerCase()}:${imageHash}`;
    const cached = await cache.getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, results: cached, cached: true });
    }

    // build search query using CLIP description if image available
    let searchQuery = '';
    if (imageUrl) {
      const description = await webSearch.describeGarmentImage(imageUrl);
      if (description) {
        const parts = [];
        if (gender) parts.push(gender);
        if (description.color) parts.push(description.color);
        if (description.garmentType) parts.push(description.garmentType);
        else if (itemType && itemType !== 'Garment') parts.push(itemType);
        if (primaryFiber) parts.push(primaryFiber);
        searchQuery = parts.join(' ');
      }
    }

    if (!searchQuery) {
      const parts = [];
      if (gender) parts.push(gender);
      if (itemType && itemType !== 'Garment') parts.push(itemType);
      if (primaryFiber) parts.push(primaryFiber);
      searchQuery = parts.join(' ') || 'clothing';
    }

    const searchResult = await ebayService.searchSecondHand(searchQuery, { limit, gender });

    if (!searchResult.success) {
      return res.status(500).json({
        success: false,
        error: searchResult.error,
        results: [],
      });
    }

    // cache for 24 hours
    if (searchResult.results.length > 0) {
      await cache.setCached(cacheKey, searchResult.results, 86400);
    }

    res.json({
      success: true,
      results: searchResult.results,
      total: searchResult.total,
    });
  } catch (error) {
    console.error('eBay search endpoint error:', error);
    res.status(500).json({ success: false, error: error.message, results: [] });
  }
});

module.exports = router;
