const Redis = require('ioredis');

// High-performance cache with Redis fallback to in-memory
class Cache {
  constructor() {
    this.memCache = new Map();
    this.memTtl = new Map();
    this.redis = null;
    
    // Try to connect to Redis
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('⚠️  Redis unavailable, using in-memory cache');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      });
      
      this.redis.connect().then(() => {
        console.log('✅ Redis cache connected');
      }).catch(() => {
        console.log('ℹ️  Using in-memory cache (Redis unavailable)');
        this.redis = null;
      });
    } catch (error) {
      console.log('ℹ️  Using in-memory cache');
      this.redis = null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    const serialized = JSON.stringify(value);
    
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.setex(key, ttlSeconds, serialized);
        return;
      } catch (err) {
        console.warn('Redis set error, falling back to memory:', err.message);
      }
    }
    
    // Fallback to in-memory
    this.memCache.set(key, serialized);
    this.memTtl.set(key, Date.now() + (ttlSeconds * 1000));
  }

  async get(key) {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.warn('Redis get error, falling back to memory:', err.message);
      }
    }
    
    // Fallback to in-memory
    if (!this.memCache.has(key)) return null;
    
    const expiresAt = this.memTtl.get(key);
    if (Date.now() > expiresAt) {
      this.memCache.delete(key);
      this.memTtl.delete(key);
      return null;
    }
    
    const data = this.memCache.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key) {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn('Redis delete error:', err.message);
      }
    }
    
    this.memCache.delete(key);
    this.memTtl.delete(key);
  }

  async clear() {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.flushdb();
      } catch (err) {
        console.warn('Redis clear error:', err.message);
      }
    }
    
    this.memCache.clear();
    this.memTtl.clear();
  }

  async clearPattern(pattern) {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (err) {
        console.warn('Redis pattern clear error:', err.message);
      }
    }
    
    // Also clear from memory
    const regex = new RegExp(pattern);
    for (const key of this.memCache.keys()) {
      if (regex.test(key)) {
        this.memCache.delete(key);
        this.memTtl.delete(key);
      }
    }
  }
}

// Create singleton instance
const cache = new Cache();

// Middleware to cache GET requests
const cacheMiddleware = (ttlSeconds = 60) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = `${req.originalUrl || req.url}`;
    
    try {
      const cached = await cache.get(key);
      if (cached) {
        return res.json(cached);
      }
    } catch (err) {
      // Continue without cache on error
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(data) {
      cache.set(key, data, ttlSeconds).catch(() => {});
      return originalJson(data);
    };

    next();
  };
};

module.exports = { cache, cacheMiddleware };
