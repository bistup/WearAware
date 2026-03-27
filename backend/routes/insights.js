// sustainability insights routes
// aggregates scan data over time for charts and trends

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');

// GET /api/insights/sustainability - get scan trends and lifetime totals
router.get('/sustainability', async (req, res) => {
  try {
    const userId = await getUserId(req.authUid);
    if (!userId) return res.status(404).json({ success: false, error: 'User not found' });

    const period = req.query.period === 'month' ? 'month' : 'week';

    // trends over last 6 months grouped by period
    const trendsResult = await pool.query(`
      SELECT
        date_trunc($1, created_at) AS period,
        COUNT(*)::int AS scan_count,
        ROUND(AVG(environmental_score))::int AS avg_score,
        COALESCE(ROUND(SUM(water_usage_liters)::numeric, 1), 0) AS total_water,
        COALESCE(ROUND(SUM(carbon_footprint_kg)::numeric, 2), 0) AS total_carbon
      FROM scans
      WHERE user_id = $2
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc($1, created_at)
      ORDER BY period ASC
    `, [period, userId]);

    // lifetime totals
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_scans,
        ROUND(AVG(environmental_score))::int AS avg_score,
        COALESCE(ROUND(SUM(water_usage_liters)::numeric, 1), 0) AS total_water,
        COALESCE(ROUND(SUM(carbon_footprint_kg)::numeric, 2), 0) AS total_carbon,
        MAX(environmental_grade) AS best_grade
      FROM scans
      WHERE user_id = $1
    `, [userId]);

    // grade distribution
    const gradesResult = await pool.query(`
      SELECT environmental_grade AS grade, COUNT(*)::int AS count
      FROM scans
      WHERE user_id = $1
      GROUP BY environmental_grade
      ORDER BY environmental_grade ASC
    `, [userId]);

    // fiber breakdown across all scans
    const fibersResult = await pool.query(`
      SELECT fibers FROM scans WHERE user_id = $1 AND fibers IS NOT NULL
    `, [userId]);

    // aggregate fiber percentages
    const fiberTotals = {};
    for (const row of fibersResult.rows) {
      const fibers = typeof row.fibers === 'string' ? JSON.parse(row.fibers) : row.fibers;
      if (Array.isArray(fibers)) {
        for (const f of fibers) {
          const name = f.name || f.fiber || 'Unknown';
          fiberTotals[name] = (fiberTotals[name] || 0) + (f.percentage || 0);
        }
      }
    }
    const topFibers = Object.entries(fiberTotals)
      .map(([name, total]) => ({ name, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    res.json({
      success: true,
      trends: trendsResult.rows,
      totals: totalsResult.rows[0] || { total_scans: 0, avg_score: 0, total_water: 0, total_carbon: 0 },
      grades: gradesResult.rows,
      topFibers,
    });
  } catch (error) {
    console.error('Error fetching sustainability insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
