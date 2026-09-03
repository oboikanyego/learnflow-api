import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';
import { getAiPlanQueueHealth } from '../services/ai-plan-queue.service.js';
import { pingRedis } from '../services/redis.service.js';

export async function getSystemHealth(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const mongoState = mongoose.connection.readyState;
    const [redis, queue] = await Promise.all([pingRedis(), getAiPlanQueueHealth()]);
    const mongoHealthy = mongoState === 1;
    const redisHealthy = redis.configured && redis.available && !queue.unavailable;

    res.json({
      status: mongoHealthy && redisHealthy ? 'HEALTHY' : 'DEGRADED',
      checkedAt: new Date().toISOString(),
      services: {
        api: { status: 'UP' },
        mongodb: { status: mongoHealthy ? 'UP' : 'DOWN', readyState: mongoState },
        redis: {
          status: !redis.configured ? 'NOT_CONFIGURED' : redis.available ? 'UP' : 'DOWN',
          latencyMs: redis.latencyMs ?? null,
          queueStatus: !queue.configured ? 'NOT_CONFIGURED' : queue.unavailable ? 'UNAVAILABLE' : 'UP',
          waitingJobs: queue.waiting,
          activeJobs: queue.active,
          delayedJobs: queue.delayed,
          failedJobs: queue.failed
        },
        email: { status: env.RESEND_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED', sender: env.EMAIL_FROM },
        ai: {
          status: env.AI_PROVIDER ? 'CONFIGURED' : 'NOT_CONFIGURED',
          provider: env.AI_PROVIDER ?? null,
          queueConcurrency: env.AI_QUEUE_CONCURRENCY
        }
      }
    });
  } catch (error) { next(error); }
}
