import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getWindowCounter } from '../services/redis.service.js';
import { getSystemLimit, listSystemLimitAudit, listSystemLimits, SYSTEM_LIMIT_KEYS, updateSystemLimit } from '../services/system-limit.service.js';

const updateLimitSchema = z.object({ value: z.number().int().nonnegative() });

export async function getSystemLimits(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await listSystemLimits()); } catch (error) { next(error); }
}

export async function getSystemLimitAudit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 250);
    res.json(await listSystemLimitAudit(limit));
  } catch (error) { next(error); }
}

export async function getYoutubeQuotaUsage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const [globalLimit, dailyLimit, hourlyLimit, globalCounter, dailyCounter, hourlyCounter] = await Promise.all([
      getSystemLimit(SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_GLOBAL_DAILY),
      getSystemLimit(SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_USER_DAILY),
      getSystemLimit(SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_USER_HOURLY),
      getWindowCounter('youtube:search:global:day'),
      getWindowCounter(`youtube:search:user:${req.user!.id}:day`),
      getWindowCounter(`youtube:search:user:${req.user!.id}:hour`)
    ]);
    const shape = (counter: { count: number; ttlSeconds: number } | undefined, limit: number) => ({
      used: counter?.count ?? 0,
      limit,
      remaining: Math.max(0, limit - (counter?.count ?? 0)),
      resetsAt: counter?.ttlSeconds ? new Date(Date.now() + counter.ttlSeconds * 1000).toISOString() : null
    });
    res.json({
      globalDaily: shape(globalCounter, globalLimit),
      currentAdminDaily: shape(dailyCounter, dailyLimit),
      currentAdminHourly: shape(hourlyCounter, hourlyLimit)
    });
  } catch (error) { next(error); }
}

export async function patchSystemLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { value } = updateLimitSchema.parse(req.body);
    res.json(await updateSystemLimit(String(req.params.key), value, req.user!.id));
  } catch (error) { next(error); }
}
