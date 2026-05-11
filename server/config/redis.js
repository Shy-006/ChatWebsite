const { createClient } = require('redis');

let isConnected = false;

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: false
  }
});

redisClient.on('error', (err) => {
  // We log the error but we don't crash.
  console.error('Redis Client Error: Not available. Falling back to DB only.');
});

redisClient.on('connect', () => {
  isConnected = true;
  console.log('Redis Connected');
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    // Non-fatal error
    console.error('Initial Redis connection failed, continuing without cache layer.');
  }
};

// Safe cache wrapper methods
const safeCache = {
  set: async (key, value, mode, time) => {
    if (isConnected) {
      try { await redisClient.set(key, value, mode, time); } catch(e) {}
    }
  },
  get: async (key) => {
    if (isConnected) {
      try { return await redisClient.get(key); } catch(e) {}
    }
    return null;
  },
  del: async (key) => {
    if (isConnected) {
      try { await redisClient.del(key); } catch(e) {}
    }
  }
};

module.exports = { redisClient: safeCache, connectRedis };
