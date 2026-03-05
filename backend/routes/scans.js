// author: caitriona mccann
// date: 27/11/2025
// last updated: 30/01/2026
// handles all scan-related api routes - save, update, fetch, delete
// calculates environmental impact from fiber composition
// uPDATED: Enhanced with research-based sustainability metrics

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const cache = require('../cache');
const mlService = require('../services/mlService');

// calculates environmental impact from fiber composition and garment weight
// mUST stay in sync with src/utils/impactCalculator.js
function calculateEnvironmentalImpact(fibers, weightGrams) {
  // impact data per kg: water (liters), carbon (kg co2), sustainability score, microplastics, chemicals, etc.
  const fiberImpact = {
    // natural fibers
    Cotton: { water: 10000, carbon: 1.55, score: 60, microplastic: 0, chemical: 65, renewable: 40, pollution: 60 },
    'Organic Cotton': { water: 5000, carbon: 1.0, score: 80, microplastic: 0, chemical: 15, renewable: 60, pollution: 20 },
    Flax: { water: 2500, carbon: 0.66, score: 85, microplastic: 0, chemical: 10, renewable: 75, pollution: 15 },
    Linen: { water: 2500, carbon: 0.66, score: 85, microplastic: 0, chemical: 10, renewable: 75, pollution: 15 },
    Jute: { water: 2000, carbon: 0.67, score: 82, microplastic: 0, chemical: 12, renewable: 70, pollution: 18 },
    Hemp: { water: 2500, carbon: 0.70, score: 84, microplastic: 0, chemical: 8, renewable: 80, pollution: 10 },
    Ramie: { water: 2800, carbon: 1.77, score: 68, microplastic: 0, chemical: 30, renewable: 55, pollution: 35 },
    Kenaf: { water: 2200, carbon: 0.60, score: 83, microplastic: 0, chemical: 10, renewable: 75, pollution: 15 },
    Sisal: { water: 1800, carbon: 0.27, score: 88, microplastic: 0, chemical: 5, renewable: 85, pollution: 8 },
    Bamboo: { water: 3000, carbon: 3.90, score: 55, microplastic: 0, chemical: 50, renewable: 65, pollution: 45 },
    'Pineapple Leaf': { water: 2000, carbon: 0.78, score: 82, microplastic: 0, chemical: 15, renewable: 70, pollution: 20 },
    'Banana Leaf': { water: 1500, carbon: 0.40, score: 86, microplastic: 0, chemical: 10, renewable: 80, pollution: 12 },
    'Corn Husk': { water: 1800, carbon: 0.74, score: 83, microplastic: 0, chemical: 18, renewable: 72, pollution: 22 },
    'Soy Protein': { water: 1600, carbon: 0.35, score: 87, microplastic: 0, chemical: 12, renewable: 78, pollution: 15 },
    Nettle: { water: 1900, carbon: 0.40, score: 86, microplastic: 0, chemical: 8, renewable: 82, pollution: 10 },
    Bhimal: { water: 2100, carbon: 0.82, score: 81, microplastic: 0, chemical: 20, renewable: 68, pollution: 25 },
    'Sugarcane Bagasse': { water: 1700, carbon: 0.68, score: 84, microplastic: 0, chemical: 15, renewable: 75, pollution: 18 },
    
    // animal fibers
    Wool: { water: 125000, carbon: 10.4, score: 45, microplastic: 0, chemical: 55, renewable: 30, pollution: 70 },
    Silk: { water: 3400, carbon: 4.5, score: 50, microplastic: 0, chemical: 40, renewable: 45, pollution: 50 },
    
    // synthetic fibers
    Polyester: { water: 45, carbon: 9.52, score: 30, microplastic: 1900, chemical: 85, renewable: 5, pollution: 90 },
    Nylon: { water: 250, carbon: 7.6, score: 35, microplastic: 1600, chemical: 80, renewable: 8, pollution: 85 },
    Acrylic: { water: 132, carbon: 8.5, score: 25, microplastic: 2200, chemical: 90, renewable: 3, pollution: 95 },
    Spandex: { water: 120, carbon: 9.0, score: 20, microplastic: 1800, chemical: 92, renewable: 2, pollution: 92 },
    Elastane: { water: 120, carbon: 9.0, score: 20, microplastic: 1800, chemical: 92, renewable: 2, pollution: 92 },
    
    // regenerated fibers
    Rayon: { water: 400, carbon: 1.2, score: 58, microplastic: 0, chemical: 70, renewable: 35, pollution: 65 },
    Viscose: { water: 400, carbon: 1.2, score: 58, microplastic: 0, chemical: 70, renewable: 35, pollution: 65 },
    Modal: { water: 350, carbon: 0.03, score: 75, microplastic: 0, chemical: 30, renewable: 70, pollution: 25 },
    Lyocell: { water: 200, carbon: 0.05, score: 80, microplastic: 0, chemical: 15, renewable: 85, pollution: 12 },
    Tencel: { water: 200, carbon: 0.05, score: 80, microplastic: 0, chemical: 15, renewable: 85, pollution: 12 },
  };

  let totalWater = 0;
  let totalCarbon = 0;
  let weightedScore = 0;
  let totalMicroplastics = 0;
  let totalChemicalImpact = 0;
  let totalRenewableEnergy = 0;
  let totalWaterPollution = 0;

  const weightKg = weightGrams / 1000; // convert to kg

  // calculate the weighted impact based on fiber percentages
  fibers.forEach((fiber) => {
    const impact = fiberImpact[fiber.name] || fiberImpact['Cotton']; // fallback to cotton
    const percentage = fiber.percentage / 100;

    totalWater += impact.water * weightKg * percentage;
    totalCarbon += impact.carbon * weightKg * percentage;
    weightedScore += impact.score * percentage;
    
    // enhanced metrics
    totalMicroplastics += impact.microplastic * weightKg * percentage;
    totalChemicalImpact += impact.chemical * percentage;
    totalRenewableEnergy += impact.renewable * percentage;
    totalWaterPollution += impact.pollution * percentage;
  });

  // apply penalty/bonus based on enhanced metrics
  if (totalMicroplastics > 1000) {
    weightedScore -= 5;
  } else if (totalMicroplastics > 500) {
    weightedScore -= 3;
  }

  if (totalChemicalImpact > 70) {
    weightedScore -= 4;
  } else if (totalChemicalImpact > 50) {
    weightedScore -= 2;
  }

  if (totalRenewableEnergy > 70) {
    weightedScore += 3;
  } else if (totalRenewableEnergy > 50) {
    weightedScore += 1;
  }

  if (totalWaterPollution > 70) {
    weightedScore -= 3;
  } else if (totalWaterPollution > 50) {
    weightedScore -= 1;
  }

  // ensure score stays within bounds
  weightedScore = Math.max(0, Math.min(100, weightedScore));

  // assign letter grade based on score
  let grade = 'F';
  if (weightedScore >= 80) grade = 'A';
  else if (weightedScore >= 65) grade = 'B';
  else if (weightedScore >= 50) grade = 'C';
  else if (weightedScore >= 35) grade = 'D';

  return {
    score: Math.round(weightedScore),
    grade,
    waterUsage: Math.round(totalWater * 100) / 100,
    carbonFootprint: Math.round(totalCarbon * 100) / 100,
  };
}

async function updateGamificationOnScan(userId, impact) {
  if (!userId) return;

  try {
    // Ensure achievement progress rows exist so scan events can increment progress.
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id, progress)
       SELECT $1, a.id, 0
       FROM achievements a
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [userId]
    );

    await pool.query(
      `UPDATE user_achievements ua
       SET progress = ua.progress + 1,
           updated_at = CURRENT_TIMESTAMP
       FROM achievements a
       WHERE ua.achievement_id = a.id
         AND ua.user_id = $1
         AND ua.unlocked = FALSE
         AND a.key = ANY($2::text[])`,
      [userId, ['first_scan', 'scan_5', 'scan_25', 'scan_100']]
    );

    if (impact?.grade === 'A') {
      await pool.query(
        `UPDATE user_achievements ua
         SET progress = ua.progress + 1,
             updated_at = CURRENT_TIMESTAMP
         FROM achievements a
         WHERE ua.achievement_id = a.id
           AND ua.user_id = $1
           AND ua.unlocked = FALSE
           AND a.key = ANY($2::text[])`,
        [userId, ['grade_a_first', 'grade_a_10']]
      );
    }

    await pool.query(
      `UPDATE user_achievements ua
       SET unlocked = TRUE,
           unlocked_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       FROM achievements a
       WHERE ua.achievement_id = a.id
         AND ua.user_id = $1
         AND ua.unlocked = FALSE
         AND ua.progress >= a.threshold`,
      [userId]
    );

    await pool.query(
      `UPDATE user_challenges uc
       SET progress = uc.progress + 1,
           completed = (uc.progress + 1) >= c.goal_value,
           completed_at = CASE
             WHEN uc.completed = FALSE AND (uc.progress + 1) >= c.goal_value THEN CURRENT_TIMESTAMP
             ELSE uc.completed_at
           END,
           updated_at = CURRENT_TIMESTAMP
       FROM challenges c
       WHERE uc.challenge_id = c.id
         AND uc.user_id = $1
         AND uc.completed = FALSE
         AND c.goal_type = 'scan_count'
         AND c.starts_at <= NOW()
         AND c.ends_at > NOW()`,
      [userId]
    );
  } catch (error) {
    console.error('Gamification update on scan failed:', error?.message || error);
  }
}

// create new scan
router.post('/', async (req, res) => {
  const {
    firebaseUid,
    brand,
    itemType,
    itemWeightGrams,
    fibers,
    rawText,
    scanType,
    imageUrl,
    thumbnailUrl,
  } = req.body;

  if (!firebaseUid || !fibers || fibers.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // find user id from firebase uid
    let userId = null;
    const userResult = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    }

    // use provided weight or look up from database
    let itemWeight = itemWeightGrams;
    
    if (!itemWeight) {
      // try cache first
      itemWeight = await cache.getCached(cache.keys.itemWeight(itemType), false).then(v => v ? parseInt(v) : null);
      
      if (!itemWeight) {
        // cache miss - query database
        const itemTypeQuery = await pool.query(
          'SELECT estimated_weight_grams FROM item_types WHERE LOWER(name) = LOWER($1)',
          [itemType || 'Garment']
        );

        itemWeight = itemTypeQuery.rows.length > 0
          ? itemTypeQuery.rows[0].estimated_weight_grams
          : 300; // default to 300g if not found
        
        // cache for next time
        await cache.setCached(cache.keys.itemWeight(itemType), itemWeight, cache.ttl.itemWeight);
      }
    }

    // calculate impact
    const impact = calculateEnvironmentalImpact(fibers, itemWeight);
    
    console.log('Calculating impact for:', { fibers, itemWeight, impact });

    // save to database
    const result = await pool.query(
      `INSERT INTO scans
       (user_id, firebase_uid, brand, item_type, item_weight_grams, fibers,
        environmental_score, environmental_grade, raw_text, scan_type,
        water_usage_liters, carbon_footprint_kg, image_url, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        userId,
        firebaseUid,
        brand,
        itemType,
        itemWeight,
        JSON.stringify(fibers),
        impact.score,
        impact.grade,
        rawText,
        scanType || 'camera',
        impact.waterUsage,
        impact.carbonFootprint,
        imageUrl || null,
        thumbnailUrl || null,
      ]
    );

    const responseData = {
      success: true,
      scan: {
        id: result.rows[0].id,
        brand: result.rows[0].brand,
        itemType: result.rows[0].item_type,
        fibers: result.rows[0].fibers,
        grade: result.rows[0].environmental_grade,
        score: result.rows[0].environmental_score,
        water_usage_liters: parseFloat(result.rows[0].water_usage_liters),
        carbon_footprint_kg: parseFloat(result.rows[0].carbon_footprint_kg),
        item_weight_grams: parseInt(result.rows[0].item_weight_grams),
        scanType: result.rows[0].scan_type,
        rawText: result.rows[0].raw_text,
        imageUrl: result.rows[0].image_url,
        thumbnailUrl: result.rows[0].thumbnail_url,
        createdAt: result.rows[0].created_at,
      },
      scanId: result.rows[0].id,
    };
    
    console.log('Returning scan data:', JSON.stringify(responseData.scan, null, 2));
    
    // invalidate user's history cache since they added a new scan
    await cache.invalidateCached(cache.keys.history(firebaseUid));

    // invalidate leaderboard caches so new scan is reflected
    await cache.invalidateCached('leaderboard:weekly');
    await cache.invalidateCached('leaderboard:monthly');
    await cache.invalidateCached('leaderboard:alltime');

    // Drive challenge/achievement progress directly from scan completion.
    await updateGamificationOnScan(userId, impact);
    
    // if garment image was provided, extract CLIP embedding in background for visual matching
    if (imageUrl) {
      const scanIdForEmbed = result.rows[0].id;
      mlService.extractEmbedding(imageUrl).then(embResult => {
        if (embResult.success) {
          pool.query(
            'UPDATE scans SET image_embedding = $1 WHERE id = $2',
            [JSON.stringify(embResult.embedding), scanIdForEmbed]
          ).then(() => {
            console.log(`CLIP embedding saved for scan ${scanIdForEmbed}`);
          }).catch(err => {
            console.log('Failed to save CLIP embedding:', err.message);
          });
        } else {
          console.log('CLIP embedding extraction failed:', embResult.error);
        }
      }).catch(err => {
        console.log('CLIP embedding extraction error:', err.message);
      });
    }
    
    res.json(responseData);
  } catch (error) {
    console.error('Error creating scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// get scan history for logged-in users only
router.get('/history/:firebaseUid', async (req, res) => {
  const { firebaseUid: requestedUid } = req.params;
  const firebaseUid = req.authUid;

  if (!firebaseUid) {
    return res.status(403).json({
      error: 'Access denied',
      success: false,
    });
  }

  try {
    // check cache first
    const cached = await cache.getCached(cache.keys.history(firebaseUid));
    if (cached) {
      return res.json({ success: true, scans: cached });
    }

    // make sure user exists (not anonymous)
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (userCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Guest users cannot access scan history',
        success: false,
      });
    }

    // fetch all scans for this user
    const result = await pool.query(
      `SELECT * FROM scans 
       WHERE firebase_uid = $1 
       ORDER BY created_at DESC`,
      [firebaseUid]
    );

    const mappedScans = result.rows.map((scan) => ({
      id: scan.id,
      brand: scan.brand,
      itemType: scan.item_type,
      fibers: scan.fibers,
      grade: scan.environmental_grade,
      score: scan.environmental_score,
      water_usage_liters: parseFloat(scan.water_usage_liters),
      carbon_footprint_kg: parseFloat(scan.carbon_footprint_kg),
      item_weight_grams: parseInt(scan.item_weight_grams),
      scanType: scan.scan_type,
      imageUrl: scan.image_url,
      thumbnailUrl: scan.thumbnail_url,
      createdAt: scan.created_at,
    }));

    // cache for 5 minutes
    await cache.setCached(cache.keys.history(firebaseUid), mappedScans, cache.ttl.history);

    res.json({
      success: true,
      scans: mappedScans,
    });
  } catch (error) {
    console.error('Error fetching scan history:', error);
    res.status(500).json({ error: error.message });
  }
});

// get single scan by id (user must own it)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid } = req.query;

  try {
    // find scan belonging to this user
    const result = await pool.query(
      'SELECT * FROM scans WHERE id = $1 AND firebase_uid = $2',
      [id, firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    res.json({
      success: true,
      scan: {
        id: result.rows[0].id,
        brand: result.rows[0].brand,
        itemType: result.rows[0].item_type,
        fibers: result.rows[0].fibers,
        grade: result.rows[0].environmental_grade,
        score: result.rows[0].environmental_score,
        water_usage_liters: parseFloat(result.rows[0].water_usage_liters),
        carbon_footprint_kg: parseFloat(result.rows[0].carbon_footprint_kg),
        item_weight_grams: parseInt(result.rows[0].item_weight_grams),
        scanType: result.rows[0].scan_type,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// update scan (user must own it)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid, brand, itemType, fibers } = req.body;

  if (!firebaseUid || !fibers || fibers.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // verify user owns this scan
    const ownerCheck = await pool.query(
      'SELECT id FROM scans WHERE id = $1 AND firebase_uid = $2',
      [id, firebaseUid]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    // get item weight from database or use default
    const scanData = await pool.query('SELECT item_weight_grams FROM scans WHERE id = $1', [id]);
    const itemWeight = scanData.rows[0]?.item_weight_grams || 300;

    // recalculate environmental impact with updated fibers
    const impact = calculateEnvironmentalImpact(fibers, itemWeight);

    // update scan in database
    const result = await pool.query(
      `UPDATE scans 
       SET brand = $1, item_type = $2, fibers = $3, environmental_score = $4, environmental_grade = $5, 
           water_usage_liters = $6, carbon_footprint_kg = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND firebase_uid = $9
       RETURNING *`,
      [
        brand,
        itemType,
        JSON.stringify(fibers),
        impact.score,
        impact.grade,
        impact.waterUsage,
        impact.carbonFootprint,
        id,
        firebaseUid,
      ]
    );

    // invalidate user's history cache since they modified a scan
    await cache.invalidateCached(cache.keys.history(firebaseUid));

    res.json({
      success: true,
      scan: {
        id: result.rows[0].id,
        brand: result.rows[0].brand,
        itemType: result.rows[0].item_type,
        fibers: result.rows[0].fibers,
        grade: result.rows[0].environmental_grade,
        score: result.rows[0].environmental_score,
        water_usage_liters: parseFloat(result.rows[0].water_usage_liters),
        carbon_footprint_kg: parseFloat(result.rows[0].carbon_footprint_kg),
        item_weight_grams: parseInt(result.rows[0].item_weight_grams),
        scanType: result.rows[0].scan_type,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error updating scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// delete scan (user must own it)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid } = req.body;

  try {
    // delete only if user owns it
    const result = await pool.query(
      'DELETE FROM scans WHERE id = $1 AND firebase_uid = $2 RETURNING id',
      [id, firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    // invalidate user's history cache since they deleted a scan
    await cache.invalidateCached(cache.keys.history(firebaseUid));

    res.json({
      success: true,
      message: 'Scan deleted',
    });
  } catch (error) {
    console.error('Error deleting scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VISUAL SIMILARITY ENDPOINTS
// ============================================================================

// create visual scan (scans full garment image for style matching)
router.post('/visual-scan', async (req, res) => {
  const {
    firebaseUid,
    imageUrl,
    itemType,
    brand,
    itemWeightGrams,
  } = req.body;

  if (!firebaseUid || !imageUrl) {
    return res.status(400).json({ error: 'Missing required fields: firebaseUid, imageUrl' });
  }

  try {
    // find user id
    let userId = null;
    const userResult = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    }

    // get item weight
    let itemWeight = itemWeightGrams || 300;
    if (!itemWeightGrams && itemType) {
      const itemTypeQuery = await pool.query(
        'SELECT estimated_weight_grams FROM item_types WHERE LOWER(name) = LOWER($1)',
        [itemType]
      );
      if (itemTypeQuery.rows.length > 0) {
        itemWeight = itemTypeQuery.rows[0].estimated_weight_grams;
      }
    }

    // extract CLIP embedding from image
    console.log('Extracting embedding for:', imageUrl);
    const embeddingResult = await mlService.extractEmbedding(imageUrl);

    if (!embeddingResult.success) {
      return res.status(500).json({
        error: 'Failed to extract visual features',
        details: embeddingResult.error,
      });
    }

    // create scan with image and embedding (no fiber data for visual scans)
    const result = await pool.query(
      `INSERT INTO scans
       (user_id, firebase_uid, brand, item_type, item_weight_grams, fibers,
        scan_type, image_url, image_embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        firebaseUid,
        brand || 'Unknown',
        itemType || 'Garment',
        itemWeight,
        JSON.stringify([]), // empty fibers array for visual scans
        'visual',
        imageUrl,
        JSON.stringify(embeddingResult.embedding),
      ]
    );

    // invalidate user's history cache (skip if Redis unavailable)
    try {
      await Promise.race([
        cache.invalidateCached(cache.keys.history(firebaseUid)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 1000))
      ]);
    } catch (err) {
      console.log('Cache invalidation skipped:', err.message);
    }

    res.json({
      success: true,
      scanId: result.rows[0].id,
      scan: {
        id: result.rows[0].id,
        brand: result.rows[0].brand,
        itemType: result.rows[0].item_type,
        imageUrl: result.rows[0].image_url,
        scanType: result.rows[0].scan_type,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error creating visual scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// get visually similar sustainable recommendations
router.get('/visual-recommendations/:scanId', async (req, res) => {
  const { scanId } = req.params;
  const { limit = 10 } = req.query;

  try {
    // get scan with embedding
    const scanResult = await pool.query(
      'SELECT id, item_type, image_embedding, environmental_score FROM scans WHERE id = $1',
      [scanId]
    );

    if (scanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const scan = scanResult.rows[0];

    if (!scan.image_embedding) {
      return res.status(400).json({ error: 'Scan does not have visual embedding' });
    }

    // get all alternatives of same type with embeddings
    const alternativesResult = await pool.query(
      `SELECT id, brand, product_name, item_type, image_url, thumbnail_url,
              sustainability_grade, sustainability_score, price_usd,
              external_url, primary_fiber, image_embedding,
              water_usage_liters, carbon_footprint_kg
       FROM product_recommendations
       WHERE item_type = $1
         AND image_embedding IS NOT NULL`,
      [scan.item_type]
    );

    if (alternativesResult.rows.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        message: 'No alternatives with visual data found for this item type',
      });
    }

    // calculate similarity scores
    const queryEmbedding = scan.image_embedding;
    const recommendations = mlService.findMostSimilar(
      queryEmbedding,
      alternativesResult.rows,
      parseInt(limit)
    );

    // format response
    const formattedRecs = recommendations.map((rec) => ({
      id: rec.id,
      brand: rec.brand,
      productName: rec.product_name,
      itemType: rec.item_type,
      imageUrl: rec.image_url,
      thumbnailUrl: rec.thumbnail_url,
      sustainabilityGrade: rec.sustainability_grade,
      sustainabilityScore: rec.sustainability_score,
      priceUsd: parseFloat(rec.price_usd),
      externalUrl: rec.external_url,
      primaryFiber: rec.primary_fiber,
      waterUsageLiters: parseFloat(rec.water_usage_liters),
      carbonFootprintKg: parseFloat(rec.carbon_footprint_kg),
      visualSimilarity: Math.round(rec.similarity_score * 100) / 100, // 0-1 scale
      matchPercentage: Math.round(rec.similarity_score * 100), // 0-100 scale
    }));

    res.json({
      success: true,
      recommendations: formattedRecs,
      matchType: 'visual',
      count: formattedRecs.length,
    });
  } catch (error) {
    console.error('Error getting visual recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


