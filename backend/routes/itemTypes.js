// author: caitriona mccann
// date: 27/11/2025
// item types api - provides list of clothing items with estimated weights
// used for calculating environmental impact based on garment type

const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// get all clothing types with their weights
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM item_types ORDER BY name ASC'
    );

    res.json({
      success: true,
      itemTypes: result.rows,
    });
  } catch (error) {
    console.error('Error fetching item types:', error);
    res.status(500).json({ error: error.message });
  }
});

// get weight for specific item type
router.get('/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM item_types WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (result.rows.length === 0) {
      // fallback to 300g if item type not in database
      return res.json({
        success: true,
        itemType: {
          name: name,
          estimated_weight_grams: 300,
          category: 'general',
        },
      });
    }

    res.json({
      success: true,
      itemType: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching item type:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


