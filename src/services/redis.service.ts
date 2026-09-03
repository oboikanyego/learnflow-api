import IORedis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

const CACHE_NAMESPACE = 'learnflow:v1';
let cacheConnection: IORedis | undefined;

export interface RedisHealth {
  configured: boolean;
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface RedisWindowCounter {
  count: number;
  ttlSeconds: number;
}

export const redisKeys = {
  learningPaths: (ownerId: string) => `user:${ownerId}:learning-paths`,
  learningPath: (ownerId: string, learningPathId: string) => `user:${ownerId}:learning-path:${learningPathId}`,
  hierarchy: (ownerId: string, learningPathId: string) => `user:${ownerId}:hierarchy:${learningPathId}`,
  lesson: (ownerId: string, lessonId: string) => `user:${ownerId}:lesson:${lessonId}`,
  analytics: (ownerId: string) => `user:${ownerId}:analytics`
};

export function redisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

export function createRedisConnection(options: RedisOptions = {}): IORedis {
  if (!env.REDIS_URL) {
    throw Object.assign(new Error('Redis is not configured. Set REDIS_URL on the API service.'), { statusCode: 503 });
  }

  return new IORedis(env.REDIS_URL, {
    enableReadyCheck: true,
    ...options
  });
}

function getCacheConnection(): IORedis | undefined {
  if (!redisConfigured()) return undefined;
  if (!cacheConnection) {
    cacheConnection = createRedisConnection({ maxRetriesPerRequest: 1 });
    cacheConnection.on('error', error => console.warn(`[redis-cache] ${error.message}`));
  }
  return cacheConnection;
}

function namespaced(key: string): string {
  return `${CACHE_NAMESPACE}:${key}`;
}

export async function pingRedis(): Promise<RedisHealth> {
  if (!redisConfigured()) return { configured: false, available: false };
  const client = getCacheConnection();
  if (!client) return { configured: false, available: false };

  const startedAt = Date.now();
  try {
    await client.ping();
    return { configured: true, available: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      configured: true,
      available: false,
      error: error instanceof Error ? error.message.slice(0, 160) : 'Redis unavailable'
    };
  }
}

export async function cachedJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const client = getCacheConnection();
  const redisKey = namespaced(key);

  if (client) {
    try {
      const cached = await client.get(redisKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      console.warn(`[redis-cache] read failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const value = await loader();

  if (client) {
    try {
      await client.set(redisKey, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.warn(`[redis-cache] write failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return value;
}

export async function incrementWindowCounter(key: string, windowSeconds: number): Promise<RedisWindowCounter | undefined> {
  const client = getCacheConnection();
  if (!client) return undefined;
  const redisKey = namespaced(key);

  try {
    const result = await client.eval(
      `local count = redis.call('INCR', KEYS[1])\n` +
      `if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end\n` +
      `local ttl = redis.call('TTL', KEYS[1])\n` +
      `return {count, ttl}`,
      1,
      redisKey,
      String(windowSeconds)
    ) as [number, number];
    return { count: Number(result[0]), ttlSeconds: Math.max(1, Number(result[1])) };
  } catch (error) {
    console.warn(`[redis-cache] counter failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export async function invalidateCacheKeys(...keys: Array<string | undefined>): Promise<void> {
  const client = getCacheConnection();
  const present = keys.filter((value): value is string => Boolean(value));
  if (!client || !present.length) return;

  try {
    await client.unlink(...present.map(namespaced));
  } catch (error) {
    console.warn(`[redis-cache] invalidation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function invalidateLearningCache(
  ownerId: string,
  options: { learningPathId?: string; lessonId?: string; invalidatePathList?: boolean; invalidateAnalytics?: boolean } = {}
): Promise<void> {
  const {
    learningPathId,
    lessonId,
    invalidatePathList = true,
    invalidateAnalytics = true
  } = options;

  await invalidateCacheKeys(
    invalidatePathList ? redisKeys.learningPaths(ownerId) : undefined,
    invalidateAnalytics ? redisKeys.analytics(ownerId) : undefined,
    learningPathId ? redisKeys.learningPath(ownerId, learningPathId) : undefined,
    learningPathId ? redisKeys.hierarchy(ownerId, learningPathId) : undefined,
    lessonId ? redisKeys.lesson(ownerId, lessonId) : undefined
  );
}

export async function closeRedisCache(): Promise<void> {
  if (cacheConnection) await cacheConnection.quit();
  cacheConnection = undefined;
}
