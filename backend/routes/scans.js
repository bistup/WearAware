// author: caitriona mccann
// date: 27/11/2025
// handles all scan-related api routes - save, update, fetch, delete
// calculates environmental impact from fiber composition

const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// calculates environmental impact from fiber composition and garment weight
function calculateEnvironmentalImpact(fibers, weightGrams) {
  // impact data per kg: water (liters), carbon (kg co2), sustainability score
  const fiberImpact = {
    // natural fibers
    Cotton: { water: 10000, carbon: 1.55, score: 60 },
    'Organic Cotton': { water: 5000, carbon: 1.0, score: 80 },
    Flax: { water: 2500, carbon: 0.66, score: 85 },
    Linen: { water: 2500, carbon: 0.66, score: 85 },
    Jute: { water: 2000, carbon: 0.67, score: 82 },
    Hemp: { water: 2500, carbon: 0.70, score: 84 },
    Ramie: { water: 2800, carbon: 1.77, score: 68 },
    Kenaf: { water: 2200, carbon: 0.60, score: 83 },
    Sisal: { water: 1800, carbon: 0.27, score: 88 },
    Bamboo: { water: 3000, carbon: 3.90, score: 55 },
    'Pineapple Leaf': { water: 2000, carbon: 0.78, score: 82 },
    'Banana Leaf': { water: 1500, carbon: 0.40, score: 86 },
    'Corn Husk': { water: 1800, carbon: 0.74, score: 83 },
    'Soy Protein': { water: 1600, carbon: 0.35, score: 87 },
    Nettle: { water: 1900, carbon: 0.40, score: 86 },
    Bhimal: { water: 2100, carbon: 0.82, score: 81 },
    'Sugarcane Bagasse': { water: 1700, carbon: 0.68, score: 84 },
    
    // animal fibers
    Wool: { water: 125000, carbon: 10.4, score: 45 },
    Silk: { water: 3400, carbon: 4.5, score: 50 },
    
    // synthetic fibers
    Polyester: { water: 45, carbon: 9.52, score: 30 },
    Nylon: { water: 250, carbon: 7.6, score: 35 },
    Acrylic: { water: 132, carbon: 8.5, score: 25 },
    Spandex: { water: 120, carbon: 9.0, score: 20 },
    Elastane: { water: 120, carbon: 9.0, score: 20 },
    
    // regenerated fibers
    Rayon: { water: 400, carbon: 1.2, score: 58 },
    Viscose: { water: 400, carbon: 1.2, score: 58 },
    Modal: { water: 350, carbon: 0.03, score: 75 },
    Lyocell: { water: 200, carbon: 0.05, score: 80 },
    Tencel: { water: 200, carbon: 0.05, score: 80 },
  };

  let totalWater = 0;
  let totalCarbon = 0;
  let weightedScore = 0;

  const weightKg = weightGrams / 1000; // convert to kg

  // calculate the weighted impact based on fiber percentages
  fibers.forEach((fiber) => {
    const impact = fiberImpact[fiber.name] || fiberImpact['Cotton']; // fallback to cotton
    const percentage = fiber.percentage / 100;

    totalWater += impact.water * weightKg * percentage;
    totalCarbon += impact.carbon * weightKg * percentage;
    weightedScore += impact.score * percentage;
  });

  // assign letter grade based on score
  let grade = 'F';
  if (weightedScore >= 80) grade = 'A';
  else if (weightedScore >= 70) grade = 'B';
  else if (weightedScore >= 60) grade = 'C';
  else if (weightedScore >= 50) grade = 'D';
  else if (weightedScore >= 40) grade = 'E';

  return {
    score: Math.round(weightedScore),
    grade,
    waterUsage: Math.round(totalWater * 100) / 100,
    carbonFootprint: Math.round(totalCarbon * 100) / 100,
  };
}

// create new scan
router.post('/', async (req, res) => {
  const {
    firebaseUid,
    brand,
    itemType,
    fibers,
    rawText,
    scanType,
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

    // get estimated weight for this item type
    const itemTypeQuery = await pool.query(
      'SELECT estimated_weight_grams FROM item_types WHERE LOWER(name) = LOWER($1)',
      [itemType || 'Garment']
    );

    const itemWeight = itemTypeQuery.rows.length > 0
      ? itemTypeQuery.rows[0].estimated_weight_grams
      : 300; // default to 300g if not found

    // calculate impact
    const impact = calculateEnvironmentalImpact(fibers, itemWeight);

    // save to database
    const result = await pool.query(
      `INSERT INTO scans 
       (user_id, firebase_uid, brand, item_type, item_weight_grams, fibers, 
        environmental_score, environmental_grade, raw_text, scan_type,
        water_usage_liters, carbon_footprint_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        createdAt: result.rows[0].created_at,
      },
      scanId: result.rows[0].id,
    };
    
    console.log('Returning scan data:', JSON.stringify(responseData.scan, null, 2));
    res.json(responseData);
  } catch (error) {
    console.error('Error creating scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// get scan history for logged-in users only
router.get('/history/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;

  try {
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

    res.json({
      success: true,
      scans: result.rows.map((scan) => ({
        id: scan.id,
        brand: scan.brand,
        itemType: scan.item_type,
        fibers: scan.fibers,
        grade: scan.grade,
        score: scan.score,
        water_usage_liters: parseFloat(scan.water_usage_liters),
        carbon_footprint_kg: parseFloat(scan.carbon_footprint_kg),
        item_weight_grams: parseInt(scan.item_weight_grams),
        scanType: scan.scan_type,
        createdAt: scan.created_at,
      })),
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
        grade: result.rows[0].grade,
        score: result.rows[0].score,
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

    res.json({
      success: true,
      message: 'Scan deleted',
    });
  } catch (error) {
    console.error('Error deleting scan:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


