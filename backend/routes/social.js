// author: caitriona mccann
// date: 09/02/2026
// social routes - handles follows, posts, feed, likes, comments
// powers the social feed and community features

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { getUserId } = require('../database/db');
const cache = require('../cache');

// --- profiles

// GET /api/social/profile/:firebaseUid - get user profile with stats
router.get('/profile/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;
  const viewerUid = req.query.viewerUid;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // get or create profile
    let profile = await pool.query(
      `SELECT up.*, u.email, u.firebase_uid
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE up.user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      // auto-create profile
      const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      const fallbackName = userRow.rows[0]?.email?.split('@')[0] || firebaseUid.substring(0, 8);
      await pool.query(
        `INSERT INTO user_profiles (user_id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, fallbackName]
      );
      profile = await pool.query(
        `SELECT up.*, u.email, u.firebase_uid
         FROM user_profiles up
         JOIN users u ON u.id = up.user_id
         WHERE up.user_id = $1`,
        [userId]
      );
    }

    // Normalize legacy UID-fragment display names to a friendlier default.
    const currentDisplayName = profile.rows[0]?.display_name || '';
    const looksLikeUidFragment = /^[A-Za-z0-9]{8}$/.test(currentDisplayName) && currentDisplayName === firebaseUid.substring(0, 8);
    if (!currentDisplayName || looksLikeUidFragment) {
      const emailPrefix = profile.rows[0]?.email?.split('@')[0] || 'User';
      await pool.query(
        `UPDATE user_profiles
         SET display_name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [emailPrefix, userId]
      );
      profile.rows[0].display_name = emailPrefix;
    }

    // get follower/following counts
    const followerCount = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE following_id = $1',
      [userId]
    );
    const followingCount = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [userId]
    );

    // compute sustainability stats from scans
    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total_scans,
        ROUND(AVG(environmental_score)) as avg_score,
        ROUND(AVG(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN environmental_score END)) as recent_avg
       FROM scans WHERE firebase_uid = $1`,
      [firebaseUid]
    );

    const gradeDistribution = await pool.query(
      `SELECT environmental_grade as grade, COUNT(*) as count
       FROM scans WHERE firebase_uid = $1
       GROUP BY environmental_grade
       ORDER BY grade`,
      [firebaseUid]
    );

    // check if viewer is following this user
    let isFollowing = false;
    if (viewerUid && viewerUid !== firebaseUid) {
      const viewerId = await getUserId(viewerUid);
      if (viewerId) {
        const followCheck = await pool.query(
          'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
          [viewerId, userId]
        );
        isFollowing = followCheck.rows.length > 0;
      }
    }

    // get public posts
    let viewerUserId = null;
    if (viewerUid) {
      viewerUserId = await getUserId(viewerUid);
    }

    const publicPosts = await pool.query(
      `SELECT sp.*, s.brand, s.item_type, s.environmental_grade, s.environmental_score,
              s.water_usage_liters, s.carbon_footprint_kg, s.fibers,
              s.image_url, s.thumbnail_url,
              u.firebase_uid as author_uid, u.email as author_email,
              up.display_name as author_name, up.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = sp.id) as like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = sp.id) as comment_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = sp.id AND l.user_id = $2) as user_liked
       FROM scan_posts sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN scans s ON s.id = sp.scan_id
       WHERE sp.user_id = $1 AND sp.visibility = 'public'
       ORDER BY sp.created_at DESC
       LIMIT 20`,
      [userId, viewerUserId || 0]
    );

    // get user's wardrobe for profile
    const userWardrobe = await pool.query(
      `SELECT id, name, brand, item_type, category, image_url, thumbnail_url,
              environmental_grade, wear_count, is_favorite
       FROM wardrobe_items WHERE user_id = $1
       ORDER BY is_favorite DESC, updated_at DESC
       LIMIT 12`,
      [userId]
    );

    // get user's outfits for profile
    const userOutfits = await pool.query(
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
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.updated_at DESC
        LIMIT 10`,
      [userId]
    );

    const totalScans = parseInt(stats.rows[0]?.total_scans) || 0;
    const avgScore = parseInt(stats.rows[0]?.avg_score) || 0;
    const recentAvg = parseInt(stats.rows[0]?.recent_avg) || 0;
    const improvement = recentAvg > 0 && avgScore > 0 ? recentAvg - avgScore : 0;

    // derive average grade
    let avgGrade = 'C';
    if (avgScore >= 80) avgGrade = 'A';
    else if (avgScore >= 65) avgGrade = 'B';
    else if (avgScore >= 50) avgGrade = 'C';
    else if (avgScore >= 35) avgGrade = 'D';
    else avgGrade = 'F';

    // update cached stats in profile
    await pool.query(
      `UPDATE user_profiles SET total_scans = $1, average_grade = $2, sustainability_score = $3
       WHERE user_id = $4`,
      [totalScans, avgGrade, avgScore, userId]
    );

    res.json({
      success: true,
      profile: {
        ...profile.rows[0],
        follower_count: parseInt(followerCount.rows[0].count),
        following_count: parseInt(followingCount.rows[0].count),
        total_scans: totalScans,
        avg_score: avgScore,
        avg_grade: avgGrade,
        improvement_percentage: improvement,
        grade_distribution: gradeDistribution.rows,
        is_following: isFollowing,
      },
      wardrobe: userWardrobe.rows.map(row => ({
        id: row.id,
        name: row.name,
        brand: row.brand,
        itemType: row.item_type,
        category: row.category,
        imageUrl: row.image_url,
        thumbnailUrl: row.thumbnail_url,
        environmentalGrade: row.environmental_grade,
        wearCount: row.wear_count,
        isFavorite: row.is_favorite,
      })),
      posts: publicPosts.rows.map(formatPost),
      outfits: userOutfits.rows.map(row => ({
        id: row.id,
        name: row.name,
        dayOfWeek: row.day_of_week,
        items: row.items || [],
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/social/profile - update own profile
router.put('/profile', async (req, res) => {
  const { firebaseUid, displayName, bio, privacyLevel, avatarUrl } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO user_profiles (user_id, display_name, bio, privacy_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = COALESCE($2, user_profiles.display_name),
         bio = COALESCE($3, user_profiles.bio),
         privacy_level = COALESCE($4, user_profiles.privacy_level),
         avatar_url = COALESCE($5, user_profiles.avatar_url),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, displayName, bio, privacyLevel, avatarUrl]
    );

    await cache.invalidateCached('leaderboard:weekly');
    await cache.invalidateCached('leaderboard:monthly');
    await cache.invalidateCached('leaderboard:alltime');

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- follows

// POST /api/social/follow - follow a user
router.post('/follow', async (req, res) => {
  const { firebaseUid, targetFirebaseUid } = req.body;

  try {
    const followerId = await getUserId(firebaseUid);
    const followingId = await getUserId(targetFirebaseUid);

    if (!followerId || !followingId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (followerId === followingId) {
      return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
    }

    await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    // invalidate feed cache for follower
    await cache.invalidateCached(cache.keys.feed(firebaseUid));

    res.json({ success: true, message: 'Followed successfully' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/social/follow - unfollow a user
router.delete('/follow', async (req, res) => {
  const { firebaseUid, targetFirebaseUid } = req.body;

  try {
    const followerId = await getUserId(firebaseUid);
    const followingId = await getUserId(targetFirebaseUid);

    if (!followerId || !followingId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    await cache.invalidateCached(cache.keys.feed(firebaseUid));

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/followers/:firebaseUid - get followers
router.get('/followers/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT u.firebase_uid, u.email, up.display_name, up.avatar_url, up.sustainability_score
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const total = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE following_id = $1',
      [userId]
    );

    res.json({
      success: true,
      followers: result.rows,
      total: parseInt(total.rows[0].count),
      page,
      hasMore: offset + limit < parseInt(total.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/following/:firebaseUid - get who user follows
router.get('/following/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT u.firebase_uid, u.email, up.display_name, up.avatar_url, up.sustainability_score
       FROM follows f
       JOIN users u ON u.id = f.following_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const total = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [userId]
    );

    res.json({
      success: true,
      following: result.rows,
      total: parseInt(total.rows[0].count),
      page,
      hasMore: offset + limit < parseInt(total.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/search - search users by email/display name
router.get('/search', async (req, res) => {
  const { q, firebaseUid } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  if (!q || q.length < 2) {
    return res.status(400).json({ success: false, error: 'Search query too short' });
  }

  try {
    const searchTerm = `%${q.toLowerCase()}%`;

    const result = await pool.query(
      `SELECT u.firebase_uid, u.email, up.display_name, up.avatar_url, 
              up.sustainability_score, up.total_scans
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE (LOWER(u.email) LIKE $1 OR LOWER(up.display_name) LIKE $1)
         AND u.firebase_uid != $2
       ORDER BY up.sustainability_score DESC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [searchTerm, firebaseUid || '', limit, offset]
    );

    res.json({
      success: true,
      users: result.rows,
      page,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- posts

// POST /api/social/posts - create a post (share a scan)
router.post('/posts', async (req, res) => {
  const { firebaseUid, scanId, caption, visibility } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // verify scan ownership if scanId provided
    if (scanId) {
      const scanCheck = await pool.query(
        'SELECT id FROM scans WHERE id = $1 AND firebase_uid = $2',
        [scanId, firebaseUid]
      );
      if (scanCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Scan not found or access denied' });
      }
    }

    const result = await pool.query(
      `INSERT INTO scan_posts (user_id, scan_id, caption, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, scanId || null, caption || null, visibility || 'private']
    );

    // invalidate feed caches for all followers
    const followers = await pool.query(
      `SELECT u.firebase_uid FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1`,
      [userId]
    );

    for (const follower of followers.rows) {
      await cache.invalidateCached(cache.keys.feed(follower.firebase_uid));
    }

    res.json({
      success: true,
      post: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/feed - get feed (posts from followed users)
router.get('/feed', async (req, res) => {
  const { firebaseUid } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // check cache for page 1
    if (page === 1) {
      const cached = await cache.getCached(cache.keys.feed(firebaseUid));
      if (cached) {
        return res.json({ success: true, posts: cached, page: 1, hasMore: true, cached: true });
      }
    }

     // fetch posts from followed users only (own posts appear in My Posts tab)
    const result = await pool.query(
      `SELECT sp.*, s.brand, s.item_type, s.environmental_grade, s.environmental_score,
              s.water_usage_liters, s.carbon_footprint_kg, s.fibers,
              s.image_url, s.thumbnail_url,
              u.firebase_uid as author_uid, u.email as author_email,
              up.display_name as author_name, up.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = sp.id) as like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = sp.id) as comment_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = sp.id AND l.user_id = $1) as user_liked
       FROM scan_posts sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN scans s ON s.id = sp.scan_id
       WHERE (sp.visibility = 'public' AND sp.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))
          OR (sp.visibility = 'followers' AND sp.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const posts = result.rows.map(formatPost);

    // cache page 1
    if (page === 1 && posts.length > 0) {
      await cache.setCached(cache.keys.feed(firebaseUid), posts, cache.ttl.feed);
    }

    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM scan_posts sp
       WHERE (sp.visibility = 'public' AND sp.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))
          OR (sp.visibility = 'followers' AND sp.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))`,
      [userId]
    );

    res.json({
      success: true,
      posts,
      page,
      hasMore: offset + limit < parseInt(totalResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/feed/discover - discover public posts from all users
router.get('/feed/discover', async (req, res) => {
  const { firebaseUid } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    let currentUserId = null;
    if (firebaseUid) {
      currentUserId = await getUserId(firebaseUid);
    }

    const result = await pool.query(
      `SELECT sp.*, s.brand, s.item_type, s.environmental_grade, s.environmental_score,
              s.water_usage_liters, s.carbon_footprint_kg, s.fibers,
              s.image_url, s.thumbnail_url,
              u.firebase_uid as author_uid, u.email as author_email,
              up.display_name as author_name, up.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = sp.id) as like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = sp.id) as comment_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = sp.id AND l.user_id = $3) as user_liked
       FROM scan_posts sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN scans s ON s.id = sp.scan_id
       WHERE sp.visibility = 'public'
       ORDER BY sp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset, currentUserId || 0]
    );

    res.json({
      success: true,
      posts: result.rows.map(formatPost),
      page,
      hasMore: result.rows.length === limit,
    });
  } catch (error) {
    console.error('Error fetching discover feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/feed/mine - get current user's own posts (all visibilities)
router.get('/feed/mine', async (req, res) => {
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
      `SELECT sp.*, s.brand, s.item_type, s.environmental_grade, s.environmental_score,
              s.water_usage_liters, s.carbon_footprint_kg, s.fibers,
              s.image_url, s.thumbnail_url,
              u.firebase_uid as author_uid, u.email as author_email,
              up.display_name as author_name, up.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = sp.id) as like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = sp.id) as comment_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = sp.id AND l.user_id = $1) as user_liked
       FROM scan_posts sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN scans s ON s.id = sp.scan_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      posts: result.rows.map(formatPost),
      page,
      hasMore: result.rows.length === limit,
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- likes

// POST /api/social/posts/:postId/like - toggle like
router.post('/posts/:postId/like', async (req, res) => {
  const { postId } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // check if already liked
    const existing = await pool.query(
      'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    let liked;
    if (existing.rows.length > 0) {
      // unlike
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      await pool.query('UPDATE scan_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1', [postId]);
      liked = false;
    } else {
      // like
      await pool.query(
        'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [postId, userId]
      );
      await pool.query('UPDATE scan_posts SET like_count = like_count + 1 WHERE id = $1', [postId]);
      liked = true;
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM likes WHERE post_id = $1',
      [postId]
    );

    res.json({
      success: true,
      liked,
      likeCount: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- comments

// GET /api/social/posts/:postId/comments - get comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT c.*, u.firebase_uid as author_uid, u.email as author_email,
              up.display_name as author_name, up.avatar_url as author_avatar
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE c.post_id = $1 AND c.parent_id IS NULL
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [postId, limit, offset]
    );

    // get replies for each top-level comment
    const commentsWithReplies = await Promise.all(
      result.rows.map(async (comment) => {
        const replies = await pool.query(
          `SELECT c.*, u.firebase_uid as author_uid, u.email as author_email,
                  up.display_name as author_name, up.avatar_url as author_avatar
           FROM comments c
           JOIN users u ON u.id = c.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
           WHERE c.parent_id = $1
           ORDER BY c.created_at ASC
           LIMIT 5`,
          [comment.id]
        );
        return { ...comment, replies: replies.rows };
      })
    );

    res.json({
      success: true,
      comments: commentsWithReplies,
      page,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/social/posts/:postId/comments - add comment
router.post('/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const { firebaseUid, content, parentId } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
  }

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, parent_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, parentId || null, content.trim()]
    );

    // update comment count on post
    await pool.query(
      'UPDATE scan_posts SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );

    // fetch author info
    const authorInfo = await pool.query(
      `SELECT u.firebase_uid, u.email, up.display_name, up.avatar_url
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    res.json({
      success: true,
      comment: {
        ...result.rows[0],
        author_uid: authorInfo.rows[0]?.firebase_uid,
        author_email: authorInfo.rows[0]?.email,
        author_name: authorInfo.rows[0]?.display_name,
        author_avatar: authorInfo.rows[0]?.avatar_url,
      },
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/social/comments/:commentId - delete own comment
router.delete('/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const { firebaseUid } = req.body;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const comment = await pool.query(
      'SELECT post_id FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (comment.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Comment not found or access denied' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);

    // update comment count
    await pool.query(
      'UPDATE scan_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1',
      [comment.rows[0].post_id]
    );

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/wardrobe/:firebaseUid - get a user's wardrobe (public view)
router.get('/wardrobe/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;

  try {
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT id, name, brand, item_type, color, category, image_url, thumbnail_url,
              environmental_grade, environmental_score, wear_count, is_favorite
       FROM wardrobe_items WHERE user_id = $1
       ORDER BY is_favorite DESC, updated_at DESC
       LIMIT 30`,
      [userId]
    );

    res.json({
      success: true,
      items: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        brand: row.brand,
        itemType: row.item_type,
        color: row.color,
        category: row.category,
        imageUrl: row.image_url,
        thumbnailUrl: row.thumbnail_url,
        environmentalGrade: row.environmental_grade,
        wearCount: row.wear_count,
        isFavorite: row.is_favorite,
      })),
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching user wardrobe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/social/outfits/:firebaseUid - get a user's outfits (public view)
router.get('/outfits/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;

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
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.updated_at DESC
        LIMIT 20`,
      [userId]
    );

    res.json({
      success: true,
      outfits: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        dayOfWeek: row.day_of_week,
        items: row.items || [],
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching user outfits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// format post for api response
function formatPost(row) {
  return {
    id: row.id,
    userId: row.user_id,
    scanId: row.scan_id,
    caption: row.caption,
    visibility: row.visibility,
    likeCount: parseInt(row.like_count) || 0,
    commentCount: parseInt(row.comment_count) || 0,
    userLiked: row.user_liked || false,
    createdAt: row.created_at,
    author: {
      firebaseUid: row.author_uid,
      email: row.author_email,
      displayName: row.author_name,
      avatarUrl: row.author_avatar,
    },
    scan: row.scan_id ? {
      brand: row.brand,
      itemType: row.item_type,
      grade: row.environmental_grade,
      score: row.environmental_score,
      waterUsage: parseFloat(row.water_usage_liters) || 0,
      carbonFootprint: parseFloat(row.carbon_footprint_kg) || 0,
      fibers: row.fibers,
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
    } : null,
  };
}

module.exports = router;
