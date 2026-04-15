// author: caitriona mccann
// date: 10/12/2025
// redis cache - generic get/set/invalidate with key constants
//
// redis is NOT installed on the proxmox server, so every call to getCached
// returns null and setCached/invalidateCached silently no-op.
// the app works fully without redis - routes simply skip the cache layer
// and always hit postgres. if redis is ever installed, it will start caching
// automatically without any code changes.
//
// TTL strategy:
//   history       5 min  - scan lists change rarely but should feel fresh
//   feed          2 min  - social feed should update quickly after new posts
//   summary       24 hr  - ai summaries are expensive to generate; never stale
//   leaderboard   5 min  - ok to be slightly behind; recalculation is expensive
//   recommendations 1 hr - product suggestions don't change frequently
//   itemWeight    1 hr   - item type weights are static lookup data

const redis = require('redis');

// create the redis client - if redis is not running, connect() will fail
// but that error is caught below and the client stays in a non-ready state
const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',  // default to localhost (same machine as backend)
    port: process.env.REDIS_PORT || 6379,          // default redis port
  },
});

// connect() is async - errors are expected on the proxmox server where redis isn't installed
client.connect().catch((err) => console.error('redis connection error:', err));
client.on('connect', () => console.log('connected to redis'));
// error events are emitted on reconnect attempts - log but never crash the process
client.on('error', (err) => console.error('redis error:', err));

// key builders - centralised here so all routes use identical key formats
// and invalidation is consistent (e.g. feed(uid) matches exactly what was set)
const keys = {
  history: (uid) => `history:${uid}`,            // scan history list for a user
  itemWeight: (type) => `item_weight:${type.toLowerCase()}`,  // garment type weight lookup
  summary: (id) => `summary:${id}`,              // ai-generated summary for a scan
  feed: (uid) => `feed:${uid}`,                  // social feed for a user
  recommendations: (id) => `recommendations:${id}`,  // product alternatives for a scan
  leaderboard: (period) => `leaderboard:${period}`,  // leaderboard for weekly/monthly/all-time
};

// TTL values in seconds - matched to how frequently each data type changes
const ttl = {
  history: 300,           // 5 min - scan history is append-only, rarely invalidated
  itemWeight: 3600,       // 1 hour - item weights are static config data
  summary: 86400,         // 24 hours - ollama summaries are expensive; content never changes
  feed: 120,              // 2 min - feed should reflect new posts quickly
  recommendations: 3600,  // 1 hour - product results change infrequently
  leaderboard: 300,       // 5 min - ok to show slightly stale rankings
};

/**
 * Store a value in Redis with a TTL.
 * Silently no-ops if Redis is unavailable (client.isReady is false).
 * Accepts both plain strings and objects (objects are JSON-serialised).
 *
 * @param {string} key - cache key, built using the keys helpers above
 * @param {any} data - value to cache; objects are stringified automatically
 * @param {number} ttlSeconds - number of seconds before the key expires
 * @returns {Promise<void>}
 */
const setCached = async (key, data, ttlSeconds) => {
  // isReady check prevents node-redis from queuing commands while reconnecting,
  // which would cause callers to hang indefinitely when Redis is unavailable
  if (!client.isReady) return;
  try {
    // serialise objects to JSON strings; strings are stored as-is
    const value = typeof data === 'string' ? data : JSON.stringify(data);
    // setEx: SET key value EX ttlSeconds (atomic set + expiry)
    await client.setEx(key, ttlSeconds, value);
  } catch (error) {
    // log but never throw - cache failure should never break a request
    console.error('cache set error:', error);
  }
};

/**
 * Retrieve a value from Redis by key.
 * Returns null if the key doesn't exist, has expired, or Redis is unavailable.
 *
 * @param {string} key - cache key to look up
 * @param {boolean} [parse=true] - if true, JSON.parse the cached string before returning
 * @returns {Promise<any|null>} parsed value, raw string, or null on miss/error
 */
const getCached = async (key, parse = true) => {
  // skip the network call entirely if redis isn't connected
  if (!client.isReady) return null;
  try {
    // GET returns null on a cache miss (key expired or never set)
    const cached = await client.get(key);
    if (!cached) return null;
    // parse JSON back to the original object; skip parsing for raw string values
    return parse ? JSON.parse(cached) : cached;
  } catch (error) {
    // JSON.parse errors or network errors - return null so caller falls through to DB
    console.error('cache get error:', error);
    return null;
  }
};

/**
 * Delete a key from Redis, invalidating the cached value.
 * Called after writes (new scan, profile update, etc.) to ensure fresh data
 * is fetched from Postgres on the next request.
 * Silently no-ops if Redis is unavailable.
 *
 * @param {string} key - cache key to delete, built using the keys helpers
 * @returns {Promise<void>}
 */
const invalidateCached = async (key) => {
  // skip if redis isn't connected - the key will expire on its own TTL anyway
  if (!client.isReady) return;
  try {
    // DEL removes the key immediately regardless of its TTL
    await client.del(key);
  } catch (error) {
    // log but never throw - failing to invalidate just means slightly stale data
    console.error('cache invalidate error:', error);
  }
};

module.exports = { client, keys, ttl, setCached, getCached, invalidateCached };
