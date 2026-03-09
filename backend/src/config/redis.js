const logger = require('../utils/logger');

// In-memory fallback cache when Redis is unavailable
const memCache = new Map();
const memCacheTTL = new Map();

const cleanExpired = () => {
  const now = Date.now();
  for (const [key, expiry] of memCacheTTL.entries()) {
    if (now > expiry) { memCache.delete(key); memCacheTTL.delete(key); }
  }
};

let redisClient = null;
let redisAvailable = false;

const initRedis = async () => {
  if (!process.env.REDIS_URL) return;
  try {
    const { createClient } = require('redis');
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 3000, reconnectStrategy: (r) => r > 3 ? false : r * 500 },
    });
    redisClient.on('error', () => { redisAvailable = false; });
    redisClient.on('connect', () => { redisAvailable = true; logger.info('Redis connected'); });
    await redisClient.connect();
    redisAvailable = true;
  } catch (err) {
    logger.warn('Redis unavailable, using in-memory cache:', err.message);
  }
};

initRedis().catch(() => {});

const cache = {
  get: async (key) => {
    try {
      if (redisAvailable && redisClient) {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      }
    } catch { redisAvailable = false; }
    cleanExpired();
    const val = memCache.get(key);
    return val !== undefined ? val : null;
  },
  set: async (key, value, ttlSeconds = 300) => {
    try {
      if (redisAvailable && redisClient) {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
        return;
      }
    } catch { redisAvailable = false; }
    memCache.set(key, value);
    memCacheTTL.set(key, Date.now() + ttlSeconds * 1000);
    if (memCache.size > 1000) cleanExpired();
  },
  del: async (key) => {
    try {
      if (redisAvailable && redisClient) { await redisClient.del(key); return; }
    } catch { redisAvailable = false; }
    memCache.delete(key); memCacheTTL.delete(key);
  },
  delPattern: async (pattern) => {
    try {
      if (redisAvailable && redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length) await redisClient.del(keys);
        return;
      }
    } catch { redisAvailable = false; }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memCache.keys()) {
      if (regex.test(key)) { memCache.delete(key); memCacheTTL.delete(key); }
    }
  },
};

module.exports = { cache, getRedisClient: () => redisClient };
