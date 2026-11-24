import { createClient } from 'redis';
import { env } from '../configs/env.js';
import { logger } from './logger.js';

let redisClient;
let redisEnabled = false;

export const initializeRedis = async () => {
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not set. Redis-backed cache and Socket.IO scaling are disabled.');
    return null;
  }

  redisClient = createClient({ url: env.REDIS_URL });

  redisClient.on('error', (error) => {
    logger.error({ error }, 'Redis client error');
  });

  try {
    await redisClient.connect();
    redisEnabled = true;
    logger.info('Redis connected');
    return redisClient;
  } catch (error) {
    redisEnabled = false;
    logger.error({ error }, 'Redis connection failed. Falling back to in-memory behavior.');
    return null;
  }
};

export const getRedisClient = () => {
  if (!redisEnabled || !redisClient?.isReady) {
    return null;
  }

  return redisClient;
};

export const createRedisPubSubClients = async () => {
  const baseClient = getRedisClient();
  if (!baseClient) {
    return null;
  }

  const pubClient = baseClient.duplicate();
  const subClient = baseClient.duplicate();

  await pubClient.connect();
  await subClient.connect();

  return { pubClient, subClient };
};

export const closeRedis = async () => {
  if (!redisClient?.isOpen) {
    return;
  }

  await redisClient.quit();
  redisEnabled = false;
};
