import { env } from '../configs/env.js';
import { getRedisClient } from '../services/redis.js';
import { logger } from '../services/logger.js';

const buildCacheKey = (req, prefix) => {
  const queryString = new URLSearchParams(req.query).toString();
  return `${prefix}:${req.path}:${queryString}`;
};

export const cacheMiddleware = ({
  prefix,
  ttlSeconds = env.CACHE_TTL_SECONDS,
  keyBuilder,
}) => {
  return async (req, res, next) => {
    const redis = getRedisClient();
    if (!redis) {
      return next();
    }

    const cacheKey = keyBuilder ? keyBuilder(req) : buildCacheKey(req, prefix);

    try {
      const cachedValue = await redis.get(cacheKey);
      if (cachedValue) {
        return res.json(JSON.parse(cachedValue));
      }

      const originalJson = res.json.bind(res);
      res.json = (payload) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis
            .set(cacheKey, JSON.stringify(payload), { EX: ttlSeconds })
            .catch((error) => logger.error({ error, cacheKey }, 'Failed writing cache entry'));
        }

        return originalJson(payload);
      };

      next();
    } catch (error) {
      logger.error({ error, cacheKey }, 'Cache middleware error');
      next();
    }
  };
};

export const invalidateCacheByPrefix = async (prefixes) => {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    for (const prefix of prefixes) {
      const keys = [];
      const scanIterator = redis.scanIterator({ MATCH: `${prefix}:*`, COUNT: 100 });

      for await (const key of scanIterator) {
        keys.push(key);
      }

      if (keys.length > 0) {
        await redis.del(keys);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Cache invalidation error');
  }
};
