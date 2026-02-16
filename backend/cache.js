// author: caitriona mccann
// date: 10/12/2025
// redis cache - generic get/set/invalidate with key constants

const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

client.connect().catch((err) => console.error('redis connection error:', err));
client.on('connect', () => console.log('connected to redis'));
client.on('error', (err) => console.error('redis error:', err));

// key builders and ttls
const keys = {
  history: (uid) => `history:${uid}`,
  itemWeight: (type) => `item_weight:${type.toLowerCase()}`,
  summary: (id) => `summary:${id}`,
  feed: (uid) => `feed:${uid}`,
  recommendations: (id) => `recommendations:${id}`,
  leaderboard: (period) => `leaderboard:${period}`,
};

const ttl = {
  history: 300,       // 5 min
  itemWeight: 3600,   // 1 hour
  summary: 86400,     // 24 hours
  feed: 120,          // 2 min
  recommendations: 3600,
  leaderboard: 300,
};

// generic cache operations - all fail silently and return null
const setCached = async (key, data, ttlSeconds) => {
  try {
    const value = typeof data === 'string' ? data : JSON.stringify(data);
    await client.setEx(key, ttlSeconds, value);
  } catch (error) {
    console.error('cache set error:', error);
  }
};

const getCached = async (key, parse = true) => {
  try {
    const cached = await client.get(key);
    if (!cached) return null;
    return parse ? JSON.parse(cached) : cached;
  } catch (error) {
    console.error('cache get error:', error);
    return null;
  }
};

const invalidateCached = async (key) => {
  try {
    await client.del(key);
  } catch (error) {
    console.error('cache invalidate error:', error);
  }
};

module.exports = { client, keys, ttl, setCached, getCached, invalidateCached };
