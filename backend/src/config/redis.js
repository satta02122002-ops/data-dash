const { createClient } = require('redis');
const logger = require('../utils/logger');

let client = null;

const getRedisClient = async () => {
  if (client) return client;

  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('connect', () => logger.info('Redis connected'));

  await client.connect();
  return client;
};

const cache = {
  get: async (key) => {
    try {
      const c = await getRedisClient();
      const val = await c.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: async (key, value, ttlSeconds = 300) => {
    try {
      const c = await getRedisClient();
      await c.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) { logger.warn('Redis set error:', err.message); }
  },
  del: async (key) => {
    try {
      const c = await getRedisClient();
      await c.del(key);
    } catch (err) { logger.warn('Redis del error:', err.message); }
  },
  delPattern: async (pattern) => {
    try {
      const c = await getRedisClient();
      const keys = await c.keys(pattern);
      if (keys.length) await c.del(keys);
    } catch (err) { logger.warn('Redis delPattern error:', err.message); }
  },
};

module.exports = { getRedisClient, cache };
