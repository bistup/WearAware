// author: caitriona mccann
// date: 26/11/2025
// all backend api calls - scans, users, social, alternatives, gamification

import { auth } from '../config/firebase';

// dev server on Proxmox LXC
const BACKEND_API_URL = 'http://YOUR_SERVER_IP:3000/api';

const getUid = () => auth.currentUser?.uid;

const jsonHeaders = { 'Content-Type': 'application/json' };

// generic fetch wrapper to reduce try/catch boilerplate
const apiFetch = async (url, options = {}, fallback = null) => {
  try {
    const response = await fetch(url, { headers: jsonHeaders, ...options });
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

// ============================================================================
// users
// ============================================================================

export const syncUserWithBackend = async (firebaseUser) => {
  if (!firebaseUser || firebaseUser.isAnonymous) {
    return { success: false, error: 'Guest users are not synced' };
  }
  return apiFetch(`${BACKEND_API_URL}/users/sync`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: firebaseUser.uid, email: firebaseUser.email }),
  });
};

// ============================================================================
// item types
// ============================================================================

export const getItemWeight = async (itemType) => {
  try {
    const data = await apiFetch(`${BACKEND_API_URL}/item-types/${itemType}`);
    return data.success ? data.itemType.estimated_weight_grams : 300;
  } catch {
    return 300;
  }
};

// ============================================================================
// scans
// ============================================================================

export const saveScanToBackend = async (scanData) => {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'No user logged in' };
  if (user.isAnonymous) return { success: true, scanId: null, local: true };

  const data = await apiFetch(`${BACKEND_API_URL}/scans`, {
    method: 'POST',
    body: JSON.stringify({
      firebaseUid: user.uid,
      brand: scanData.brand,
      itemType: scanData.itemType,
      itemWeightGrams: scanData.itemWeightGrams,
      fibers: scanData.fibers,
      rawText: scanData.rawText,
      scanType: scanData.scanType || 'camera',
      imageUrl: scanData.imageUrl,
      thumbnailUrl: scanData.thumbnailUrl,
    }),
  });
  return data.success ? { success: true, scanId: data.scanId, scan: data.scan } : data;
};

export const fetchScanHistory = async () => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return { success: false, error: 'Guest users cannot access scan history', scans: [] };
  }
  const data = await apiFetch(`${BACKEND_API_URL}/scans/history/${user.uid}`, {}, { scans: [] });
  return { success: data.success !== false, scans: data.scans || [], error: data.error };
};

export const fetchScanById = async (scanId) => {
  const user = auth.currentUser;
  if (!user || !scanId) return { success: false, error: 'Invalid request' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}?firebaseUid=${user.uid}`);
};

export const deleteScan = async (scanId) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { success: false, error: 'Unauthorized' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: user.uid }),
  });
};

export const updateScan = async (scanId, updatedData) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { success: false, error: 'Unauthorized' };
  return apiFetch(`${BACKEND_API_URL}/scans/${scanId}`, {
    method: 'PUT',
    body: JSON.stringify({
      firebaseUid: user.uid,
      brand: updatedData.brand,
      itemType: updatedData.itemType,
      fibers: updatedData.fibers,
    }),
  });
};

// ============================================================================
// ai summaries
// ============================================================================

export const generateAiSummary = async (scanId) => {
  return apiFetch(`${BACKEND_API_URL}/summaries/${scanId}`, { method: 'POST' });
};

export const generateAiSummaryFromData = async (scanData) => {
  return apiFetch(`${BACKEND_API_URL}/summaries/generate`, {
    method: 'POST',
    body: JSON.stringify(scanData),
  });
};

// ============================================================================
// sOCIAL - profiles, follows, feed, posts, likes, comments
// ============================================================================

export const fetchUserProfile = async (targetFirebaseUid) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/profile/${targetFirebaseUid}?viewerUid=${getUid() || ''}`
  );
};

export const updateUserProfile = async ({ displayName, bio, privacyLevel }) => {
  return apiFetch(`${BACKEND_API_URL}/social/profile`, {
    method: 'PUT',
    body: JSON.stringify({ firebaseUid: getUid(), displayName, bio, privacyLevel }),
  });
};

export const followUser = async (targetFirebaseUid) => {
  return apiFetch(`${BACKEND_API_URL}/social/follow`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid }),
  });
};

export const unfollowUser = async (targetFirebaseUid) => {
  return apiFetch(`${BACKEND_API_URL}/social/follow`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid(), targetFirebaseUid }),
  });
};

export const fetchFollowers = async (firebaseUid, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/followers/${firebaseUid}?page=${page}`,
    {},
    { followers: [] }
  );
};

export const fetchFollowing = async (firebaseUid, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/following/${firebaseUid}?page=${page}`,
    {},
    { following: [] }
  );
};

export const searchUsers = async (query, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/search?q=${encodeURIComponent(query)}&firebaseUid=${getUid()}&page=${page}`,
    {},
    { users: [] }
  );
};

export const createPost = async ({ scanId, caption, visibility }) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), scanId, caption, visibility }),
  });
};

export const fetchFeed = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed?firebaseUid=${getUid()}&page=${page}`,
    {},
    { posts: [] }
  );
};

export const fetchDiscoverFeed = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed/discover?firebaseUid=${getUid() || ''}&page=${page}`,
    {},
    { posts: [] }
  );
};

export const fetchMyPosts = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/feed/mine?firebaseUid=${getUid()}&page=${page}`,
    {},
    { posts: [] }
  );
};

export const toggleLike = async (postId) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

export const fetchComments = async (postId, page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/social/posts/${postId}/comments?page=${page}`,
    {},
    { comments: [] }
  );
};

export const addComment = async (postId, content, parentId = null) => {
  return apiFetch(`${BACKEND_API_URL}/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), content, parentId }),
  });
};

export const deleteComment = async (commentId) => {
  return apiFetch(`${BACKEND_API_URL}/social/comments/${commentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

// ============================================================================
// aLTERNATIVES - recommendations, comparison, wishlist
// ============================================================================

export const fetchRecommendations = async (itemType) => {
  const params = new URLSearchParams();
  if (itemType) params.append('itemType', itemType);
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/recommendations?${params.toString()}`,
    {},
    { recommendations: [] }
  );
};

export const fetchComparison = async (scanId, recommendationId) => {
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/compare?scanId=${scanId}&recommendationId=${recommendationId}&firebaseUid=${getUid()}`
  );
};

export const fetchWishlist = async (page = 1) => {
  return apiFetch(
    `${BACKEND_API_URL}/alternatives/wishlist?firebaseUid=${getUid()}&page=${page}`,
    {},
    { wishlist: [] }
  );
};

export const addToWishlist = async (recommendationId, notes = '') => {
  return apiFetch(`${BACKEND_API_URL}/alternatives/wishlist`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), recommendationId, notes }),
  });
};

export const removeFromWishlist = async (wishlistId) => {
  return apiFetch(`${BACKEND_API_URL}/alternatives/wishlist/${wishlistId}`, {
    method: 'DELETE',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

// ============================================================================
// gAMIFICATION - achievements, challenges, leaderboard
// ============================================================================

export const fetchAchievements = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/gamification/achievements?firebaseUid=${getUid()}`,
    {},
    { achievements: [] }
  );
};

export const checkAchievements = async (eventType, eventData = {}) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/achievements/check`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), eventType, eventData }),
  });
};

export const shareAchievement = async (achievementId) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/achievements/${achievementId}/share`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

export const fetchChallenges = async () => {
  return apiFetch(
    `${BACKEND_API_URL}/gamification/challenges?firebaseUid=${getUid()}`,
    {},
    { challenges: [] }
  );
};

export const joinChallenge = async (challengeId) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/challenges/${challengeId}/join`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid() }),
  });
};

export const updateChallengeProgress = async (eventType, value = 1) => {
  return apiFetch(`${BACKEND_API_URL}/gamification/challenges/update-progress`, {
    method: 'POST',
    body: JSON.stringify({ firebaseUid: getUid(), eventType, value }),
  });
};

export const fetchLeaderboard = async (period = 'weekly') => {
  return apiFetch(
    `${BACKEND_API_URL}/gamification/leaderboard?period=${period}&firebaseUid=${getUid() || ''}`,
    {},
    { leaderboard: [] }
  );
};

// ============================================================================
// VISUAL SCAN - CLIP image similarity
// ============================================================================

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

export const fetchVisualRecommendations = async (scanId) => {
  return apiFetch(
    `${BACKEND_API_URL}/scans/visual-recommendations/${scanId}`,
    {},
    { recommendations: [] }
  );
};

// ============================================================================
// WEB SEARCH - live product search from the web
// ============================================================================

export const searchWebAlternatives = async (itemType, primaryFiber, imageUrl, gender) => {
  const params = new URLSearchParams();
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

// ============================================================================
// EBAY SECOND-HAND - pre-owned clothing search
// ============================================================================

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
