import { readFile } from 'node:fs/promises';
import { getRedisClient } from './redis.js';

export const DEFAULT_HOLD_TTL_MS = 5 * 60 * 1000;

const scriptSources = new Map();
const loadScript = (name) => {
  if (!scriptSources.has(name)) {
    scriptSources.set(name, readFile(new URL(`../scripts/${name}.lua`, import.meta.url), 'utf8'));
  }
  return scriptSources.get(name);
};

const getSeatLockKeys = (showId, seatIds) =>
  seatIds.map((seatId) => `hold:{${showId}}:${seatId}`);

export const acquireSeatLocks = async ({
  showId,
  seatIds,
  userId,
  ttlMs = DEFAULT_HOLD_TTL_MS,
}) => {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis is required to reserve seats.');
  }

  const fencingToken = String(await redis.incr(`fence:{${showId}}`));
  const expiresAt = Date.now() + ttlMs;
  const result = await redis.eval(await loadScript('acquireSeatLocks'), {
    keys: getSeatLockKeys(showId, seatIds),
    arguments: [userId, fencingToken, String(ttlMs), String(expiresAt), ...seatIds],
  });

  return JSON.parse(result);
};

export const releaseSeatLocks = async ({ showId, seatIds, userId, fencingToken }) => {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis is required to release seat reservations.');
  }

  const result = await redis.eval(await loadScript('releaseSeatLocks'), {
    keys: getSeatLockKeys(showId, seatIds),
    arguments: [userId, String(fencingToken), ...seatIds],
  });

  const releasedSeatIds = JSON.parse(result);
  return Array.isArray(releasedSeatIds) ? releasedSeatIds : [];
};

export const verifySeatLocks = async ({ showId, seatIds, userId, fencingToken }) => {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis is required to verify seat reservations.');
  }

  const result = await redis.eval(await loadScript('verifySeatLocks'), {
    keys: getSeatLockKeys(showId, seatIds),
    arguments: [userId, String(fencingToken), ...seatIds],
  });
  const verification = JSON.parse(result);
  return {
    valid: verification.valid === true,
    missingSeatIds: Array.isArray(verification.missingSeatIds) ? verification.missingSeatIds : [],
  };
};

export const getSeatLocks = async (showId) => {
  const redis = getRedisClient();
  if (!redis) {
    return [];
  }

  const keys = [];
  for await (const key of redis.scanIterator({
    MATCH: `hold:{${showId}}:*`,
    COUNT: 100,
  })) {
    keys.push(key);
  }

  if (keys.length === 0) {
    return [];
  }

  const values = await redis.mGet(keys);
  return values.flatMap((value, index) => {
    if (!value) {
      return [];
    }

    try {
      const lock = JSON.parse(value);
      return [{
        seatId: keys[index].slice(keys[index].lastIndexOf(':') + 1),
        userId: lock.userId,
        expiresAt: lock.expiresAt,
      }];
    } catch {
      return [];
    }
  });
};