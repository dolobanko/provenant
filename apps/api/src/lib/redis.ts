import Redis from 'ioredis';
import { logger } from './logger';

let _redis: Redis | null = null;
let _available = false;

export function getRedis(): Redis | null {
  return _redis;
}

export function isRedisAvailable(): boolean {
  return _available;
}

// Only initialise if REDIS_URL is explicitly set
if (process.env.REDIS_URL) {
  try {
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
    });

    _redis.on('connect', () => {
      _available = true;
      logger.info('[Redis] Connected');
    });

    _redis.on('close', () => {
      _available = false;
    });

    _redis.on('error', (err: Error) => {
      // Suppress spam — only log once per disconnect
      if (_available) {
        logger.warn('[Redis] Connection lost — falling back to in-process execution', { msg: err.message });
      }
      _available = false;
    });

    // Attempt connect but never crash the process on failure
    _redis.connect().catch(() => {
      logger.warn('[Redis] Could not connect to Redis — running without queue. Set REDIS_URL to enable.');
    });
  } catch (err) {
    logger.warn('[Redis] Failed to initialise Redis client. Falling back to in-process execution.', { err });
    _redis = null;
  }
} else {
  logger.info('[Redis] REDIS_URL not set — running without Redis queue (in-process execution)');
}

// Legacy named export kept for any existing imports
export const redis = _redis;
