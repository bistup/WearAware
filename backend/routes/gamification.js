// author: caitriona mccann
// date: 09/02/2026
// gamification routes - achievements, challenges, leaderboards
// incentivizes sustainable clothing choices through game mechanics
//
// --- POINTS SYSTEM OVERVIEW ---
//
// A user's total leaderboard score has two components:
//
//   1. SCAN POINTS
//      Earned each time a user scans a garment. The amount depends on
//      the environmental grade of the scanned item:
//        Grade A = 10 pts   (score 80+)
//        Grade B =  8 pts   (score 65-79)
//        Grade C =  6 pts   (score 50-64)
//        Grade D =  4 pts   (score 35-49)
//        Grade F =  2 pts   (score 0-34)
//      Scanning higher-grade (more sustainable) garments earns more points,
//      rewarding users who choose eco-friendly materials.
//
//   2. ACHIEVEMENT POINTS
//      One-time bonuses awarded when a user unlocks an achievement milestone
//      (e.g. "First Scan", "10 Grade-A Scans"). Each achievement has a fixed
//      points value stored in the achievements table.
//
//   TOTAL SCORE = scan_points + achievement_points
//   Leaderboard ranks by total score DESC, then scan count DESC.
//
// --- ACHIEVEMENTS ---
//   Progress is tracked per user via the user_achievements table.
//   Events that trigger progress checks (called from ScanResultScreen / FeedScreen):
//     'scan'           - any garment scan
//     'grade_a'        - scan with grade A
//     'share'          - post shared to feed
//     'follow'         - user followed someone
//     'gained_follower'- user gained a follower
//     'wishlist_add'   - item added to wishlist
//
// --- CHALLENGES ---
//   Active challenges are rows in the challenges table where ends_at > NOW().
//   Users join a challenge, then progress is updated automatically via
//   updateChallengeProgress (called from ScanResultScreen / FeedScreen).
//   Supported goal types and the events that increment them:
//     'scan_count'  <- eventType 'scan'  (value 1 per scan)
//     'share_count' <- eventType 'share' (value 1 per share)
//     'water_saved' <- eventType 'water_saved' (value = litres saved)
//     'carbon_saved'<- eventType 'carbon_saved' (value = kg saved)
//   When a joined challenge reaches goal_value, it is marked completed
//   and the user is notified.

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');
const cache = require('../cache');

// --- achievements

// GET /api/gamification/achievements - get all achievements with user progress
router.get('/achievements', async (req, res) => {
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT a.*, 
              COALESCE(ua.progress, 0) as user_progress,
              COALESCE(ua.unlocked, FALSE) as user_unlocked,
              ua.unlocked_at,
              ua.shared_to_feed
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
       ORDER BY a.category, a.threshold`,
      [userId]
    );

    const achievements = result.rows.map(row => ({
      id: row.id,
      key: row.key,
      name: row.title,
      title: row.title,
      description: row.description,
      icon: row.icon,
      category: row.category,
      threshold: row.threshold,
      points: row.points,
      user_progress: row.user_progress,
      progress: row.user_progress,
      is_unlocked: row.user_unlocked,
      unlocked: row.user_unlocked,
      unlockedAt: row.unlocked_at,
      sharedToFeed: row.shared_to_feed,
      progressPercent: Math.min(100, Math.round((row.user_progress / row.threshold) * 100)),
    }));

    // group by category
    const grouped = {};
    achievements.forEach(a => {
      if (!grouped[a.category]) grouped[a.category] = [];
      grouped[a.category].push(a);
    });

    res.json({
      success: true,
      achievements,
      grouped,
      totalPoints: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0),
      unlockedCount: achievements.filter(a => a.unlocked).length,
      totalCount: achievements.length,
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gamification/achievements/check - check and update achievement progress
// called after scans, shares, follows, etc.
router.post('/achievements/check', async (req, res) => {
  const { firebaseUid, eventType, eventData } = req.body;
  // eventType: 'scan', 'share', 'follow', 'grade_a', 'wishlist_add'
  // eventData: { grade, score, waterSaved, carbonSaved, ... }

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const newlyUnlocked = [];

    // get all achievements
    const achievements = await pool.query('SELECT * FROM achievements');

    for (const achievement of achievements.rows) {
      // ensure user_achievements row exists
      await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_id, progress)
         VALUES ($1, $2, 0)
         ON CONFLICT (user_id, achievement_id) DO NOTHING`,
        [userId, achievement.id]
      );

      // calculate progress increment based on event type and achievement key
      let increment = 0;

      switch (achievement.key) {
        case 'first_scan':
        case 'scan_5':
        case 'scan_25':
        case 'scan_100':
          if (eventType === 'scan') increment = 1;
          break;
        case 'grade_a_first':
        case 'grade_a_10':
          if (eventType === 'scan' && eventData?.grade === 'A') increment = 1;
          break;
        case 'first_share':
        case 'share_10':
          if (eventType === 'share') increment = 1;
          break;
        case 'first_follow':
          if (eventType === 'follow') increment = 1;
          break;
        case 'followers_10':
          if (eventType === 'gained_follower') increment = 1;
          break;
        case 'water_saver':
          if (eventType === 'scan' && Number(eventData?.waterSaved) > 0) {
            increment = Math.round(Number(eventData.waterSaved));
          }
          break;
        case 'carbon_cutter':
          if (eventType === 'scan' && Number(eventData?.carbonSaved) > 0) {
            increment = Math.round(Number(eventData.carbonSaved));
          }
          break;
        case 'wishlist_5':
          if (eventType === 'wishlist_add') increment = 1;
          break;
        default:
          break;
      }

      if (increment > 0) {
        // update progress
        const updateResult = await pool.query(
          `UPDATE user_achievements 
           SET progress = progress + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND achievement_id = $3 AND unlocked = FALSE
           RETURNING progress`,
          [increment, userId, achievement.id]
        );

        if (updateResult.rows.length > 0) {
          const newProgress = updateResult.rows[0].progress;
          
          // check if threshold reached
          if (newProgress >= achievement.threshold) {
            await pool.query(
              `UPDATE user_achievements 
               SET unlocked = TRUE, unlocked_at = CURRENT_TIMESTAMP
               WHERE user_id = $1 AND achievement_id = $2`,
              [userId, achievement.id]
            );

            newlyUnlocked.push({
              key: achievement.key,
              title: achievement.title,
              description: achievement.description,
              icon: achievement.icon,
              points: achievement.points,
            });
          }
        }
      }
    }

    res.json({
      success: true,
      newlyUnlocked,
      hasNewAchievements: newlyUnlocked.length > 0,
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gamification/achievements/:achievementId/share - share achievement to feed
router.post('/achievements/:achievementId/share', async (req, res) => {
  const { achievementId } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // verify achievement is unlocked
    const ua = await pool.query(
      `SELECT ua.*, a.title, a.icon, a.description, a.category
       FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1 AND ua.achievement_id = $2 AND ua.unlocked = TRUE`,
      [userId, achievementId]
    );

    if (ua.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Achievement not found or not unlocked' });
    }

    // create a post for the achievement
    const caption = `ACHIEVEMENT_SHARE|${ua.rows[0].title}|${ua.rows[0].description || ''}|${ua.rows[0].category || 'general'}`;
    await pool.query(
      `INSERT INTO scan_posts (user_id, caption, visibility)
       VALUES ($1, $2, 'public')`,
      [userId, caption]
    );

    // Invalidate feed cache for user and followers so the shared post is visible immediately.
    await cache.invalidateCached(cache.keys.feed(firebaseUid));
    const followers = await pool.query(
      `SELECT u.firebase_uid
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1`,
      [userId]
    );
    for (const follower of followers.rows) {
      await cache.invalidateCached(cache.keys.feed(follower.firebase_uid));
    }

    // mark as shared
    await pool.query(
      'UPDATE user_achievements SET shared_to_feed = TRUE WHERE user_id = $1 AND achievement_id = $2',
      [userId, achievementId]
    );

    res.json({ success: true, message: 'Achievement shared to feed' });
  } catch (error) {
    console.error('Error sharing achievement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- challenges

// GET /api/gamification/challenges - get active challenges
router.get('/challenges', async (req, res) => {
  const { firebaseUid } = req.query;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT c.*,
              uc.id as user_challenge_id,
              COALESCE(uc.progress, 0) as user_progress,
              COALESCE(uc.completed, FALSE) as user_completed,
              uc.completed_at
       FROM challenges c
       LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = $1
       WHERE c.ends_at > NOW()
       ORDER BY c.ends_at ASC`,
      [userId]
    );

    const challenges = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      icon: row.icon,
      challenge_type: row.goal_type,
      type: row.challenge_type,
      goalType: row.goal_type,
      goalValue: row.goal_value,
      target_value: row.goal_value,
      points: row.points,
      reward_points: row.points,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      end_date: row.ends_at,
      is_joined: Boolean(row.user_challenge_id),
      user_challenge_id: row.user_challenge_id,
      user_progress: row.user_progress,
      progress: row.user_progress,
      is_completed: row.user_completed,
      completed: row.user_completed,
      completedAt: row.completed_at,
      progressPercent: Math.min(100, Math.round((row.user_progress / row.goal_value) * 100)),
      daysRemaining: Math.max(0, Math.ceil((new Date(row.ends_at) - new Date()) / (1000 * 60 * 60 * 24))),
    }));

    res.json({
      success: true,
      challenges,
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gamification/challenges/:challengeId/join - join a challenge
router.post('/challenges/:challengeId/join', async (req, res) => {
  const { challengeId } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO user_challenges (user_id, challenge_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, challenge_id) DO NOTHING`,
      [userId, challengeId]
    );

    res.json({ success: true, message: 'Joined challenge' });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gamification/challenges/update-progress - update challenge progress
router.post('/challenges/update-progress', async (req, res) => {
  const { firebaseUid, eventType, value } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // find active joined challenges matching event type
    const goalTypeMap = {
      scan: 'scan_count',
      share: 'share_count',
      water_saved: 'water_saved',
      carbon_saved: 'carbon_saved',
    };

    const goalType = goalTypeMap[eventType];
    if (!goalType) {
      return res.json({ success: true, updated: 0 });
    }

    const activeChallenges = await pool.query(
      `SELECT uc.id, uc.progress, c.goal_value, c.points, c.title
       FROM user_challenges uc
       JOIN challenges c ON c.id = uc.challenge_id
       WHERE uc.user_id = $1 
         AND c.goal_type = $2
         AND c.ends_at > NOW()
         AND uc.completed = FALSE`,
      [userId, goalType]
    );

    const completed = [];
    for (const challenge of activeChallenges.rows) {
      const increment = Math.max(0, Math.round(Number(value ?? 1)));
      if (increment === 0) {
        continue;
      }

      const newProgress = challenge.progress + increment;
      const isCompleted = newProgress >= challenge.goal_value;

      await pool.query(
        `UPDATE user_challenges 
         SET progress = $1, completed = $2, completed_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [
          newProgress,
          isCompleted,
          isCompleted ? new Date() : null,
          challenge.id,
        ]
      );

      if (isCompleted) {
        completed.push({
          title: challenge.title,
          points: challenge.points,
        });
      }
    }

    res.json({
      success: true,
      updated: activeChallenges.rows.length,
      completedChallenges: completed,
    });
  } catch (error) {
    console.error('Error updating challenge progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- leaderboard

// GET /api/gamification/leaderboard - get leaderboard
router.get('/leaderboard', async (req, res) => {
  const { period, firebaseUid } = req.query;
  // period: 'weekly', 'monthly', 'alltime'
  const periodType = period || 'weekly';

  try {
    const userId = firebaseUid ? await getUserId(firebaseUid) : null;

    // try cache
    const cacheKey = `leaderboard:v3:${periodType}`;
    const cached = await cache.getCached(cacheKey);
    if (cached) {
      const currentUserRank = firebaseUid
        ? cached.find((entry) => (entry.firebase_uid || entry.firebaseUid) === firebaseUid) || null
        : null;
      return res.json({ success: true, leaderboard: cached, currentUserRank, period: periodType, cached: true });
    }

    let dateFilter;
    let achievementDateFilter;
    switch (periodType) {
      case 'weekly':
        dateFilter = "s.created_at > NOW() - INTERVAL '7 days'";
        achievementDateFilter = "AND ua.unlocked_at > NOW() - INTERVAL '7 days'";
        break;
      case 'monthly':
        dateFilter = "s.created_at > NOW() - INTERVAL '30 days'";
        achievementDateFilter = "AND ua.unlocked_at > NOW() - INTERVAL '30 days'";
        break;
      default:
        dateFilter = '1=1'; // all time
        achievementDateFilter = '';
    }

    // leaderboard query:
    // scan_points  - sum of per-scan points based on grade (A=10, B=8, C=6, D=4, F=2)
    // achievement_points - sum of points from all unlocked achievements in the period
    // total_score  - scan_points + achievement_points (used for ranking)
    // ROW_NUMBER() assigns a stable rank even when total_score is tied
    const result = await pool.query(
      `SELECT
        u.firebase_uid,
        u.email,
        up.display_name,
        up.avatar_url,
        COUNT(s.id) as scan_count,
        ROUND(AVG(s.environmental_score)) as avg_score,
        COALESCE(SUM(
          CASE s.environmental_grade
            WHEN 'A' THEN 10
            WHEN 'B' THEN 8
            WHEN 'C' THEN 6
            WHEN 'D' THEN 4
            ELSE 2
          END
        ), 0) as scan_points,
        COALESCE(a_unlocked.points, 0) as achievement_points,
        (COALESCE(SUM(
          CASE s.environmental_grade
            WHEN 'A' THEN 10
            WHEN 'B' THEN 8
            WHEN 'C' THEN 6
            WHEN 'D' THEN 4
            ELSE 2
          END
        ), 0) + COALESCE(a_unlocked.points, 0)) as total_score,
        ROW_NUMBER() OVER (
          ORDER BY (COALESCE(SUM(
                    CASE s.environmental_grade
                      WHEN 'A' THEN 10
                      WHEN 'B' THEN 8
                      WHEN 'C' THEN 6
                      WHEN 'D' THEN 4
                      ELSE 2
                    END
                  ), 0) + COALESCE(a_unlocked.points, 0)) DESC,
                   COUNT(s.id) DESC,
                   ROUND(AVG(s.environmental_score)) DESC
        ) as rank
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       JOIN scans s ON s.firebase_uid = u.firebase_uid AND ${dateFilter}
       LEFT JOIN (
         SELECT ua.user_id, SUM(a.points) as points
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.unlocked = TRUE
           ${achievementDateFilter}
         GROUP BY ua.user_id
       ) a_unlocked ON a_unlocked.user_id = u.id
       GROUP BY u.id, u.firebase_uid, u.email, up.display_name, up.avatar_url, a_unlocked.points
       HAVING COUNT(s.id) > 0
       ORDER BY total_score DESC, scan_count DESC
       LIMIT 50`
    );

    const leaderboard = result.rows.map(row => ({
      rank: parseInt(row.rank),
      firebase_uid: row.firebase_uid,
      firebaseUid: row.firebase_uid,
      email: row.email,
      display_name: row.display_name,
      displayName: row.display_name,
      avatar_url: row.avatar_url,
      avatarUrl: row.avatar_url,
      scan_count: parseInt(row.scan_count),
      scanCount: parseInt(row.scan_count),
      total_scans: parseInt(row.scan_count),
      avg_score: parseInt(row.avg_score),
      avgScore: parseInt(row.avg_score),
      scan_points: parseInt(row.scan_points),
      scanPoints: parseInt(row.scan_points),
      achievement_points: parseInt(row.achievement_points),
      achievementPoints: parseInt(row.achievement_points),
      total_score: parseInt(row.total_score),
      totalScore: parseInt(row.total_score),
      isCurrentUser: userId ? row.firebase_uid === firebaseUid : false,
    }));

    const currentUserRank = firebaseUid
      ? leaderboard.find((entry) => entry.firebase_uid === firebaseUid) || null
      : null;

    // cache for 5 minutes
    await cache.setCached(cacheKey, leaderboard, 300);

    res.json({
      success: true,
      leaderboard,
      currentUserRank,
      period: periodType,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
