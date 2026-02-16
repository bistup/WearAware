// author: caitriona mccann
// date: 10/12/2025
// handles ai summary generation for scans using ollama llm

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const cache = require('../cache');
const { generateSummary, checkOllamaHealth } = require('../services/aiService');

// generate ai summary from raw scan data (no scanId required)
router.post('/generate', async (req, res) => {
  const scanData = req.body;

  try {
    // validate required fields
    if (!scanData || !scanData.fibers) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scan data',
      });
    }

    // generate summary using ai
    const summary = await generateSummary(scanData);

    res.json({
      success: true,
      summary: summary,
      cached: false,
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
    });
  }
});

// generate ai summary for a scan
router.post('/:scanId', async (req, res) => {
  const { scanId } = req.params;

  try {
    // check cache first
    const cachedSummary = await cache.getCached(cache.keys.summary(scanId), false);
    if (cachedSummary) {
      return res.json({
        success: true,
        summary: cachedSummary,
        cached: true,
      });
    }

    // fetch scan data from database
    const scanResult = await pool.query(
      'SELECT * FROM scans WHERE id = $1',
      [scanId]
    );

    if (scanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Scan not found',
      });
    }

    const scan = scanResult.rows[0];

    // generate summary using ai
    const summary = await generateSummary(scan);

    // cache the generated summary
    await cache.setCached(cache.keys.summary(scanId), summary, cache.ttl.summary);

    res.json({
      success: true,
      summary: summary,
      cached: false,
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
    });
  }
});

// health check endpoint for ollama service
router.get('/health', async (req, res) => {
  const isHealthy = await checkOllamaHealth();
  res.json({
    success: true,
    ollama_available: isHealthy,
    model: 'llama3.2:1b',
  });
});

module.exports = router;
