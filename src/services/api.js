// author: caitriona mccann
// date: 26/11/2025
// last updated: 14/04/2026
// all backend api calls - centralised in one file to keep network logic out of screens
//
// authentication:
//   every request attaches a firebase idToken as a Bearer header via getAuthHeaders().
//   if the token is stale (401 response), apiFetch() automatically refreshes the token
//   once and retries. guest/anonymous users don't get tokens and skip auth-protected routes.
//
// error handling:
//   apiFetch() wraps all calls - on network error or non-2xx response it returns
//   { success: false, error: '...' } so screens never need try/catch blocks.
//   the optional `fallback` param is merged into error responses so callers always
//   get a predictable shape (e.g. { success: false, scans: [] }).
//
// BACKEND_API_URL comes from .env (BACKEND_API_URL=http://192.168.1.70:3000/api)
// and is loaded via react-native-dotenv / babel-plugin-module-resolver.

import { auth } from '../config/firebase';
import { BACKEND_API_URL as ENV_BACKEND_URL } from '@env';

// fall back to localhost in dev if .env is missing
const BACKEND_API_URL = ENV_BACKEND_URL || 'http://localhost:3000/api';

// returns the firebase uid of the currently logged-in user (null for guests)
const getUid = () => auth.currentUser?.uid;

const jsonHeaders = { 'Content-Type': 'application/json' };

// build Authorization header from firebase id token; empty object for guests/anonymous
const getAuthHeaders = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return {};

  try {
    const idToken = await user.getIdToken(forceRefresh);
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch (tokenError) {
    console.warn('Failed to get Firebase ID token:', tokenError?.message || tokenError);
    return {};
  }
};

// generic fetch wrapper:
//   - attaches auth headers to every request
//   - retries once with a fresh token on 401 (handles expired sessions)
//   - parses JSON response, returns { success: false, error } on any failure
//   - merges `fallback` into error returns so callers get a consistent shape
const apiFetch = async (url, options = {}, fallback = null) => {
  try {
    let authHeaders = await getAuthHeaders(false);

    const mergedHeaders = {
      ...jsonHeaders,
      ...authHeaders,
      ...(options.headers || {}),
    };

    let response = await fetch(url, { ...options, headers: mergedHeaders });

    // One retry on 401 with a forced token refresh to handle stale session tokens.
    if (response.status === 401 && auth.currentUser && !auth.currentUser.isAnonymous) {
      authHeaders = await getAuthHeaders(true);
      const retryHeaders = {
        ...jsonHeaders,
        ...authHeaders,
        ...(options.headers || {}),
      };
      response = await fetch(url, { ...options, headers: retryHeaders });
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
    if (!response.ok) return { success: false, error: data.error || 'Request failed', ...fallback };
    return data;
  } catch (error) {
    console.error(`API error [${options.method || 'GET'} ${url}]:`, error.message);
    return { success: false, error: error.message, ...fallback };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create or update the user's record in the backend database.
 * Called once after Firebase login so the users table always has a matching row.
 * Skipped for anonymous/guest users — they have no persistent backend account.
 * @param {import('firebase/auth').User} firebaseUser - the firebase user object
 */
export const syncUserWithBackend = async (firebaseUser) => {
  // guests have no backend account; silently skip the sync
  if (!firebaseUser || firebaseUser.isAnonymous) {
    return { success: false, error: 'Guest users are not synced' };
  }
  // POST /api/users/sync upserts (creates if new, updates email if changed)
  return apiFetch(`${BACKEND_API_URL}/users/sync`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: firebaseUser.uid, email: firebaseUser.email }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEM TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the estimated weight in grams for a given item type (e.g. "T-Shirt" → 200g).
 * Used by the impact calculator to convert per-kg fibre rates into absolute figures.
 * Falls back to 300g if the item type is not found or the request fails.
 * @param {string} itemType - e.g. "Jeans", "Dress", "Jacket"
 * @returns {Promise<number>} weight in grams
 */
export const getItemWeight = async (itemType) => {
  try {
    const data = await apiFetch(`${BACKEND_API_URL}/item-types/${itemType}`);
    // return the DB weight if found; otherwise fall back to 300g default
    return data.success ? data.itemType.estimated_weight_grams : 300;
  } catch {
    return 300; // safe default if request completely fails
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCANS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a completed scan to the backend database.
 * The backend independently recalculates the sustainability score for data integrity.
 * Guest users get a local-only success response (no DB write, scanId is null).
 * @param {object} scanData - scan details including brand, itemType, fibers, imageUrl, etc.
 * @returns {Promise<{success: boolean, scanId: string|null, scan: object}>}
 */
export const saveScanToBackend = async (scanData) => {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'No user logged in' };
  // guest users cannot persist scans; return success so the UI flow continues
  if (user.isAnonymous) return { success: true, scanId: null, local: true };

  const data = await apiFetch(`${BACKEND_API_URL}/scans`, {
    method: 'POST',
    body: JSON.stringify({
      firebaseUid: user.uid,       // identifies the user in the backend
      brand: scanData.brand,
      itemType: scanData.itemType,
      itemWeightGrams: scanData.itemWeightGrams, // used for absolute water/carbon figures
      fibers: scanData.fibers,     // array of { name, percentage }
      rawText: scanData.rawText,   // full OCR text for debugging
      scanType: scanData.scanType || 'camera', // 'camera' | 'manual'
      imageUrl: scanData.imageUrl,             // full garment photo URL
      thumbnailUrl: scanData.thumbnailUrl,     // 300px thumbnail URL
      isSecondHand: scanData.isSecondHand || false, // triggers 15pt score bonus
    }),
  });
  // normalise the response shape for callers
  return data.success ? { success: true, scanId: data.scanId, scan: data.scan } : data;
};

/**
 * Fetch the current user's complete scan history from the backend.
 * Returns an empty array for guests — they have no history.
 * @returns {Promise<{success: boolean, scans: Array, error?: string}>}
 */
export const fetchScanHistory = async () => {
  const user = auth.currentUser;
  // guests cannot have scan history — return empty array immediately
  if (!user || user.isAnonymous) {
    return { success: false, error: 'Guest users cannot access scan history', scans: [] };
  }
  const data = await apiFetch(`${BACKEND_API_URL}/scans/history/${user.uid}`, {}, { scans: [] });
  // normalise: treat missing success flag as success=true (some routes omit it)
  return { success: data.success !== false, scans: data.scans || [], error: data.error };
};

/**
 * Fetch a single scan by its database ID.
 * Used by ScanResultScreen when navigating from HistoryScreen.
 * @param {string|number} scanId - the scan's DB id
 */
export const fetchScanById = async (scanId) => {
  const user = auth.currentUser;
  if (!user || !scanId) return { success: false, error: 'Invalid request' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}?firebaseUid=${user.uid}`);
};

/**
 * Delete a scan by ID. Removes the record and any associated images from storage.
 * @param {string|number} scanId
 */
export const deleteScan = async (scanId) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { success: false, error: 'Unauthorized' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: user.uid }),
  });
};

/**
 * Delete the user's entire backend account (all scans, profile, social data, wardrobe).
 * GDPR right-to-erasure endpoint.
 * Note: the caller is responsible for also deleting the Firebase Auth account afterwards.
 */
export const deleteMyAccount = async () => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { success: false, error: 'Unauthorized' };
  return apiFetch(`${BACKEND_API_URL}/users/my-account`, { method: 'DELETE' });
};

/**
 * Update an existing scan's brand, item type, or fiber composition.
 * The backend recalculates the sustainability score after any change.
 * @param {string|number} scanId
 * @param {{ brand: string, itemType: string, fibers: Array }} updatedData
 */
export const updateScan = async (scanId, updatedData) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { success: false, error: 'Unauthorized' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}`, {
    method: 'PUT',
    body: JSON.stringify({
      firebaseUid: user.uid,
      brand: updatedData.brand,
      itemType: updatedData.itemType,
      fibers: updatedData.fibers, // updated fiber array recalculates score server-side
    }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// AI SUMMARIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate (or retrieve cached) an AI sustainability summary for a saved scan.
 * Calls Ollama (Llama 3.2 1B) on the backend. Falls back to a template if Ollama is down.
 * Summaries are cached in Redis for 24 hours under key summary:{scanId}.
 * @param {string|number} scanId - the saved scan's DB id
 */
export const generateAiSummary = async (scanId) => {
  return apiFetch(`${BACKEND_API_URL}/summaries/${scanId}`, { method: 'POST' });
};

/**
 * Generate an AI summary directly from scan data (without a saved scan ID).
 * Used on ScanResultScreen immediately after a new scan, before the scan is saved.
 * @param {object} scanData - raw scan data with grade, fibers, water/carbon metrics
 */
export const generateAiSummaryFromData = async (scanData) => {
  return apiFetch(`${BACKEND_API_URL}/summaries/generate`, {
    method: 'POST',
    body: JSON.stringify(scanData), // full scan object sent directly to the AI service
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL — profiles, follows, feed, posts, likes, comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a user's public profile, scan stats, wardrobe, and outfits.
 * Used by SocialProfileScreen. Viewer UID is passed so the backend can
 * include is_following status in the response.
 * @param {string} targetFirebaseUid - the profile to view
 */
export const fetchUserProfile = async (targetFirebaseUid) => {
  // viewerUid may be empty string for unauthenticated viewers (browse without login)
  return apiFetch(
    `${BACKEND_API_URL}/social/profile/${targetFirebaseUid}?viewerUid=${getUid() || ''}`
  );
};

/**
 * Update the current user's profile (display name, bio, privacy level, avatar URL).
 * @param {{ displayName: string, bio: string, privacyLevel: string, avatarUrl: string }} params
 */
export const updateUserProfile = async ({ displayName, bio, privacyLevel, avatarUrl }) => {
  return apiFetch(`${BACKEND_API_URL}/social/profile`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), displayName, bio, privacyLevel, avatarUrl }),
  });
};

/**
 * Follow a user. Creates a row in the follows table.
 * @param {string} targetFirebaseUid - the user to follow
 */
export const followUser = async (targetFirebaseUid) => {
  return apiFetch(`${BACKEND_API_URL}/social/follow`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid }),
  });
};

/**
 * Unfollow a user. Removes the row from the follows table.
 * @param {string} targetFirebaseUid - the user to unfollow
 */
export const unfollowUser = async (targetFirebaseUid) => {
  return apiFetch(`${BACKEND_API_URL}/social/follow`, {
    method: 'DELETE', // uses DELETE on the same /follow endpoint
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid }),
  });
};

/**
 * Fetch the list of users who follow the given user.
 * @param {string} firebaseUid - whose followers to fetch
 * @param {number} page - pagination page (20 per page)
 */
export const fetchFollowers = async (firebaseUid, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/followers/${firebaseUid}?page=${page}`,
    {},
    { followers: [] } // fallback so callers always get an array
  );
};

/**
 * Fetch the list of users that the given user follows.
 * @param {string} firebaseUid - whose following list to fetch
 * @param {number} page - pagination page
 */
export const fetchFollowing = async (firebaseUid, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/following/${firebaseUid}?page=${page}`,
    {},
    { following: [] }
  );
};

/**
 * Search for users by display name or email prefix.
 * Used by the search bar in FeedScreen to find people to follow.
 * @param {string} query - the search string
 * @param {number} page - pagination page
 */
export const searchUsers = async (query, page = 1) => {
  // encodeURIComponent prevents special characters from breaking the query string
  return apiFetch(
    `${BACKEND_API_URL}/social/search?q=${encodeURIComponent(query)}&firebaseUid=${getUid()}&page=${page}`,
    {},
    { users: [] }
  );
};

/**
 * Create a new social post sharing a scan to the community feed.
 * @param {{ scanId: string|number, caption: string, visibility: 'public'|'private' }} params
 */
export const createPost = async ({ scanId, caption, visibility }) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), scanId, caption, visibility }),
  });
};

/**
 * Fetch the "Following" feed — posts from users the current user follows.
 * @param {number} page - pagination page (20 posts per page)
 */
export const fetchFeed = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed?firebaseUid=${getUid()}&page=${page}`,
    {},
    { posts: [] }
  );
};

/**
 * Fetch the "Discover" feed — all public posts from all users.
 * Viewer UID is optional (empty string for unauthenticated viewers).
 * @param {number} page - pagination page
 */
export const fetchDiscoverFeed = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed/discover?firebaseUid=${getUid() || ''}&page=${page}`,
    {},
    { posts: [] }
  );
};

/**
 * Fetch only the current user's own posts ("My Posts" tab in FeedScreen).
 * @param {number} page - pagination page
 */
export const fetchMyPosts = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed/mine?firebaseUid=${getUid()}&page=${page}`,
    {},
    { posts: [] }
  );
};

/**
 * Toggle a like on a post. If already liked, removes the like; otherwise adds it.
 * Returns { liked: true|false, likeCount: number } so the UI can update immediately.
 * @param {string|number} postId
 */
export const toggleLike = async (postId) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Delete a post. Only the post's author can delete it (enforced server-side).
 * @param {string|number} postId
 */
export const deletePost = async (postId) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts/${postId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Fetch comments for a post, newest first, paginated.
 * @param {string|number} postId
 * @param {number} page - pagination page (20 per page)
 */
export const fetchComments = async (postId, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/posts/${postId}/comments?page=${page}`,
    {},
    { comments: [] }
  );
};

/**
 * Add a comment to a post. Supports threading via parentId.
 * @param {string|number} postId - the post being commented on
 * @param {string} content - the comment text
 * @param {string|number|null} parentId - parent comment ID for replies (null for top-level)
 */
export const addComment = async (postId, content, parentId = null) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), content, parentId }),
  });
};

/**
 * Delete a comment. Only the comment's author can delete it (enforced server-side).
 * @param {string|number} commentId
 */
export const deleteComment = async (commentId) => {
  return apiFetch(`${BACKEND_API_URL}/social/comments/${commentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVES — sustainable product recommendations and wishlist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch curated sustainable product recommendations from the database.
 * These are pre-seeded recommendations, not live search results.
 * @param {string} itemType - optional filter (e.g. "T-Shirt")
 */
export const fetchRecommendations = async (itemType) => {
  const params = new URLSearchParams();
  if (itemType) params.append('itemType', itemType); // optional filter
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/recommendations?${params.toString()}`,
    {},
    { recommendations: [] }
  );
};

/**
 * Fetch the current user's saved wishlist items.
 * @param {number} page - pagination page (20 per page)
 */
export const fetchWishlist = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/wishlist?firebaseUid=${getUid()}&page=${page}`,
    {},
    { wishlist: [] }
  );
};

/**
 * Save a product recommendation to the user's wishlist.
 * @param {string|number} recommendationId - the product_recommendations DB id
 * @param {string} notes - optional personal notes
 */
export const addToWishlist = async (recommendationId, notes = '') => {
  return apiFetch(`${BACKEND_API_URL}/alternatives/wishlist`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), recommendationId, notes }),
  });
};

/**
 * Remove an item from the user's wishlist.
 * @param {string|number} wishlistId - the wishlist row ID (not the recommendation ID)
 */
export const removeFromWishlist = async (wishlistId) => {
  return apiFetch(`${BACKEND_API_URL}/alternatives/wishlist/${wishlistId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GAMIFICATION — achievements, challenges, leaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all achievements with the current user's progress and unlock status.
 * Returns achievements grouped by category (scanning, social, sustainability).
 */
export const fetchAchievements = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/gamification/achievements?firebaseUid=${getUid()}`,
    {},
    { achievements: [] }
  );
};

/**
 * Fire an achievement event and get back any newly unlocked achievements.
 * Call this after significant user actions so the backend can increment progress.
 * @param {string} eventType - 'scan' | 'grade_a' | 'share' | 'follow' | 'gained_follower' | 'wishlist_add'
 * @param {object} eventData - extra context (e.g. { grade: 'A' } for grade_a events)
 * @returns {Promise<{ newlyUnlocked: Array, hasNewAchievements: boolean }>}
 */
export const checkAchievements = async (eventType, eventData = {}) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/achievements/check`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), eventType, eventData }),
  });
};

/**
 * Share an unlocked achievement to the community feed.
 * Creates a scan_posts row with a special ACHIEVEMENT_SHARE caption format.
 * @param {string|number} achievementId - the achievement to share
 */
export const shareAchievement = async (achievementId) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/achievements/${achievementId}/share`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Fetch all currently active challenges (ends_at > now) with user join/progress status.
 * Returns empty array if none are active.
 */
export const fetchChallenges = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/gamification/challenges?firebaseUid=${getUid()}`,
    {},
    { challenges: [] }
  );
};

/**
 * Join a challenge. Creates a user_challenges row so progress can be tracked.
 * Must be called before updateChallengeProgress will have any effect.
 * @param {string|number} challengeId
 */
export const joinChallenge = async (challengeId) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/challenges/${challengeId}/join`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Increment progress on all joined challenges that match the given event type.
 * Called automatically by ScanResultScreen after every scan and after sharing.
 * @param {string} eventType - 'scan' | 'share' | 'water_saved' | 'carbon_saved'
 * @param {number} value - amount to increment (1 for scan/share, litres/kg for others)
 */
export const updateChallengeProgress = async (eventType, value = 1) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/challenges/update-progress`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), eventType, value }),
  });
};

/**
 * Fetch the leaderboard for a given time period.
 * Score = scan points (A=10, B=8, C=6, D=4, F=2) + achievement points.
 * Cached in Redis for 5 minutes.
 * @param {'weekly'|'monthly'|'alltime'} period
 */
export const fetchLeaderboard = async (period = 'weekly') => {
  // getUid() may be null for unauthenticated viewing; empty string is acceptable
  return apiFetch(
    `${BACKEND_API_URL}/gamification/leaderboard?period=${period}&firebaseUid=${getUid() || ''}`,
    {},
    { leaderboard: [] }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL SCAN — CLIP garment image classification (kept for potential future use)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a visual-only scan using a garment photo (no care label OCR).
 * This endpoint was removed from the active scan flow but the function is kept
 * in case the feature is restored. Currently not called by any screen.
 * @param {string} imageUrl - URL of the uploaded garment photo
 * @param {string} itemType
 * @param {string} brand
 */
export const createVisualScan = async (imageUrl, itemType, brand) => {
  return apiFetch(`${BACKEND_API_URL}/scans/visual-scan`, {
    method: 'POST',
    body: JSON.stringify({
      firebaseUid: getUid(),
      imageUrl,
      itemType,
      brand,
    }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// WEB SEARCH — live sustainable product search via Vertex AI Discovery Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search for sustainable product alternatives using Vertex AI Discovery Engine.
 * The backend builds a query from itemType, fiber substitute, CLIP visual attributes
 * (if a garment photo was taken), and gender — then searches the indexed sustainable
 * brand data store.
 * @param {string} itemType - e.g. "T-Shirt"
 * @param {string} primaryFiber - e.g. "Polyester" (substituted to "organic cotton" server-side)
 * @param {string|null} imageUrl - garment photo URL for CLIP-enhanced query
 * @param {string|null} gender - "Men's" | "Women's" | null
 */
export const searchWebAlternatives = async (itemType, primaryFiber, imageUrl, gender) => {
  const params = new URLSearchParams();
  // only append params that have values — empty strings cause bad queries
  if (itemType) params.append('itemType', itemType);
  if (primaryFiber) params.append('primaryFiber', primaryFiber);
  if (imageUrl) params.append('imageUrl', imageUrl);
  if (gender) params.append('gender', gender);
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/search?${params.toString()}`,
    {},
    { results: [] }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EBAY SECOND-HAND — pre-owned clothing search via eBay Browse API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search eBay for pre-owned/second-hand clothing matching the scanned garment.
 * Uses OAuth2 client credentials on the backend (no user auth required for eBay).
 * Results are filtered to used/good/very good condition items in the clothing category.
 * @param {string} itemType - e.g. "Jeans"
 * @param {string} primaryFiber - e.g. "Cotton"
 * @param {string|null} imageUrl - garment photo for CLIP-enhanced search query
 * @param {string|null} gender
 */
export const searchSecondHand = async (itemType, primaryFiber, imageUrl, gender) => {
  const params = new URLSearchParams();
  if (itemType) params.append('itemType', itemType);
  if (primaryFiber) params.append('primaryFiber', primaryFiber);
  if (imageUrl) params.append('imageUrl', imageUrl);
  if (gender) params.append('gender', gender);
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/secondhand?${params.toString()}`,
    {},
    { results: [] }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARITY SHOPS — find nearby charity/thrift shops via Google Places API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch nearby charity/thrift shops using the device's GPS coordinates.
 * Backend calls Google Places API (New) text search for "charity shop" within the radius.
 * @param {number} lat - device latitude
 * @param {number} lng - device longitude
 * @param {number} radius - search radius in metres (default 5000m = 5km)
 */
export const fetchNearbyCharityShops = async (lat, lng, radius = 5000) => {
  return apiFetch(
    `${BACKEND_API_URL}/charity-shops/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    {},
    { shops: [] }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WARDROBE — manage the user's personal clothing collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the user's wardrobe items, optionally filtered by category.
 * Returns camelCase field names (the wardrobe route applies a formatItem() mapper).
 * @param {string} category - 'All' | 'Tops' | 'Bottoms' | 'Dresses' | 'Outerwear' | etc.
 */
export const fetchWardrobe = async (category) => {
  const uid = getUid();
  // only add the category param if it's not 'All' (backend returns everything for 'All')
  const params = `firebaseUid=${uid}${category && category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`;
  return apiFetch(`${BACKEND_API_URL}/wardrobe?${params}`, {}, { items: [] });
};

/**
 * Add a wardrobe item directly (from ScanResultScreen "Add to Wardrobe" button).
 * @param {object} itemData - includes scanId, brand, itemType, imageUrl, category, etc.
 */
export const addToWardrobe = async (itemData) => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), ...itemData }), // spread merges all item fields
  });
};

/**
 * Update a wardrobe item's fields (e.g. toggle isFavorite, change category).
 * @param {string|number} id - wardrobe item ID
 * @param {object} updates - partial update object (e.g. { isFavorite: true })
 */
export const updateWardrobeItem = async (id, updates) => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), ...updates }),
  });
};

/**
 * Increment the wear count for a wardrobe item by 1.
 * Used by the shoe icon button on each wardrobe card.
 * @param {string|number} id - wardrobe item ID
 */
export const logWear = async (id) => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe/${id}/wear`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Remove an item from the wardrobe. Does not delete the underlying scan.
 * @param {string|number} id - wardrobe item ID
 */
export const removeFromWardrobe = async (id) => {
  // firebaseUid passed as query param (auth middleware needs it on DELETE)
  return apiFetch(`${BACKEND_API_URL}/wardrobe/${id}?firebaseUid=${getUid()}`, {
    method: 'DELETE',
  });
};

/**
 * Fetch a list of category names that the user has items in.
 * Used to show only non-empty category chips.
 */
export const fetchWardrobeCategories = async () => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe/categories?firebaseUid=${getUid()}`, {}, { categories: [] });
};

/**
 * Bulk import all of the user's scan history into their wardrobe.
 * Skips scans that are already in the wardrobe (idempotent).
 * Returns { imported: number } indicating how many new items were added.
 */
export const importScansToWardrobe = async () => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe/import-scans`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Fetch the community marketplace — all wardrobe items listed as free or for trade.
 * @param {string} filter - 'all' | 'free' | 'trade'
 */
export const fetchMarketplace = async (filter) => {
  const uid = getUid();
  const params = `firebaseUid=${uid}${filter && filter !== 'all' ? `&filter=${filter}` : ''}`;
  return apiFetch(`${BACKEND_API_URL}/wardrobe/marketplace?${params}`, {}, { items: [], myListings: [] });
};

/**
 * Mark a wardrobe item as available on the marketplace.
 * @param {string|number} itemId - wardrobe item to list
 * @param {'free'|'trade'} availableFor - listing type
 */
export const listWardrobeItem = async (itemId, availableFor) => {
  return apiFetch(`${BACKEND_API_URL}/wardrobe/${itemId}/list`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), availableFor }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// OUTFITS — create and plan weekly outfits from wardrobe items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch outfits, optionally filtered by day of the week.
 * @param {string|undefined} day - 'Monday' | 'Tuesday' | ... | undefined for all
 */
export const fetchOutfits = async (day) => {
  // day is optional — when omitted, returns all outfits regardless of day
  const params = `firebaseUid=${getUid()}${day ? `&day=${encodeURIComponent(day)}` : ''}`;
  return apiFetch(`${BACKEND_API_URL}/outfits?${params}`, {}, { outfits: [] });
};

/**
 * Fetch outfits organised into a weekly map keyed by day name.
 * Returns { weekly: { Monday: [...], Tuesday: [...], ... } }
 */
export const fetchWeeklyOutfits = async () => {
  return apiFetch(`${BACKEND_API_URL}/outfits/weekly?firebaseUid=${getUid()}`, {}, { weekly: {} });
};

/**
 * Create a new outfit with a name, optional day assignment, and wardrobe items.
 * @param {{ name: string, dayOfWeek: string|null, itemIds: number[] }} data
 */
export const createOutfit = async (data) => {
  return apiFetch(`${BACKEND_API_URL}/outfits`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), ...data }), // spreads name, dayOfWeek, itemIds
  });
};

/**
 * Update an existing outfit's name, day, or item list.
 * @param {string|number} id - outfit ID
 * @param {object} data - fields to update
 */
export const updateOutfit = async (id, data) => {
  return apiFetch(`${BACKEND_API_URL}/outfits/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), ...data }),
  });
};

/**
 * Delete an outfit and all its outfit_items junction rows.
 * Does not delete the wardrobe items themselves.
 * @param {string|number} id - outfit ID
 */
export const deleteOutfit = async (id) => {
  return apiFetch(`${BACKEND_API_URL}/outfits/${id}?firebaseUid=${getUid()}`, {
    method: 'DELETE',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING — direct conversations, messages, and trade requests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all conversations the current user is part of, with last message preview.
 */
export const fetchConversations = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/conversations?firebaseUid=${getUid()}`,
    {},
    { conversations: [] }
  );
};

/**
 * Start a conversation with another user, or return the existing one if it exists.
 * Conversations are identified by (min(user1, user2), max(user1, user2)) to avoid duplicates.
 * @param {string} targetFirebaseUid - the user to message
 */
export const startConversation = async (targetFirebaseUid) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/conversations`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid }),
  });
};

/**
 * Fetch messages in a conversation (newest first, paginated).
 * Also marks unread messages as read on the backend.
 * @param {string|number} conversationId
 * @param {number} page - pagination page (50 messages per page)
 */
export const fetchMessages = async (conversationId, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/conversations/${conversationId}/messages?firebaseUid=${getUid()}&page=${page}`,
    {},
    { messages: [] }
  );
};

/**
 * Send a text message in a conversation.
 * @param {string|number} conversationId
 * @param {string} content - the message text
 */
export const sendMessage = async (conversationId, content) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), content }),
  });
};

/**
 * Fetch the total number of unread messages across all conversations.
 * Displayed as a badge on the messages icon in the header.
 */
export const fetchUnreadCount = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/unread-count?firebaseUid=${getUid()}`,
    {},
    { count: 0 } // fallback to 0 so badge doesn't show on error
  );
};

/**
 * Create a trade request from one user to another.
 * tradeType: 'free' (give away) or 'trade' (swap items).
 * lat/lng are used to find the nearest charity shop dropbox midpoint.
 * @param {{ targetFirebaseUid, offeredItemId, wantedItemId, tradeType, lat, lng }} params
 */
export const createTradeRequest = async ({ targetFirebaseUid, offeredItemId, wantedItemId, tradeType, lat, lng }) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/trade-request`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid, offeredItemId, wantedItemId, tradeType, lat, lng }),
  });
};

/**
 * Fetch the details of a trade request (status, charity shop, PINs, etc.).
 * @param {string|number} tradeId
 */
export const fetchTradeRequest = async (tradeId) => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/trade-request/${tradeId}?firebaseUid=${getUid()}`,
    {},
    null // no fallback — null signals "not found" to the caller
  );
};

/**
 * Accept or decline a trade request.
 * On accept, backend finds nearest charity shop to the geographic midpoint
 * and assigns PIN codes and compartment numbers to both users.
 * @param {string|number} tradeId
 * @param {'accept'|'decline'} action
 * @param {number} lat - acceptor's current latitude (for midpoint calculation)
 * @param {number} lng - acceptor's current longitude
 */
export const respondToTrade = async (tradeId, action, lat, lng) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/trade-request/${tradeId}/respond`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), action, lat, lng }),
  });
};

/**
 * Change the charity shop assigned to an accepted trade.
 * Either party can change the shop if the default one is inconvenient.
 * @param {string|number} tradeId
 * @param {{ name, address, lat, lng }} shop - the new shop details
 */
export const updateTradeShop = async (tradeId, shop) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/trade-request/${tradeId}/update-shop`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), shopName: shop.name, shopAddress: shop.address, shopLat: shop.lat, shopLng: shop.lng }),
  });
};

/**
 * Mark a trade as completed. Either party can call this once items are exchanged.
 * @param {string|number} tradeId
 */
export const completeTrade = async (tradeId) => {
  return apiFetch(`${BACKEND_API_URL}/messaging/trade-request/${tradeId}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

/**
 * Fetch all trade requests the current user is involved in (as sender or recipient).
 */
export const fetchTradeRequests = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/trade-requests?firebaseUid=${getUid()}`,
    {},
    { trades: [] }
  );
};

/**
 * Find charity shops near a coordinate pair for the trade dropbox picker.
 * Separate from fetchNearbyCharityShops — this uses the messaging route
 * which returns more structured data including opening hours.
 * @param {number} lat
 * @param {number} lng
 */
export const fetchNearbyShopsForTrade = async (lat, lng) => {
  return apiFetch(
    `${BACKEND_API_URL}/messaging/nearby-shops?lat=${lat}&lng=${lng}&firebaseUid=${getUid()}`,
    {},
    { shops: [] }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS — Expo push token registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register the device's Expo push token with the backend.
 * Called once after the user grants notification permission.
 * Stored in the push_tokens table so notifications can be sent from the server.
 * @param {string} token - the Expo push token (format: ExponentPushToken[...])
 * @param {string} platform - 'ios' | 'android'
 */
export const registerPushToken = async (token, platform) => {
  return apiFetch(`${BACKEND_API_URL}/notifications/register-token`, {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
};

/**
 * Remove the device's push token on logout so notifications stop being sent.
 * @param {string} token - the Expo push token to remove
 */
export const unregisterPushToken = async (token) => {
  return apiFetch(`${BACKEND_API_URL}/notifications/unregister-token`, {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUSTAINABILITY INSIGHTS — usage trends and statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated sustainability data for chart display on SustainabilityScreen.
 * Returns grade distribution, water/carbon totals, and top fibre types over a period.
 * @param {'week'|'month'|'year'} period - time range for the aggregation
 */
export const fetchSustainabilityInsights = async (period = 'week') => {
  return apiFetch(
    `${BACKEND_API_URL}/insights/sustainability?period=${period}&firebaseUid=${getUid()}`,
    {},
    { trends: [], totals: {}, grades: [], topFibers: [] }
  );
};
