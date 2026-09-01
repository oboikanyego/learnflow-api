import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';

export async function getSystemHealth(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const mongoState = mongoose.connection.readyState;
    res.json({
      status: mongoState === 1 ? 'HEALTHY' : 'DEGRADED',
      checkedAt: new Date().toISOString(),
      services: {
        api: { status: 'UP' },
        mongodb: { status: mongoState === 1 ? 'UP' : 'DOWN', readyState: mongoState },
        redis: { status: env.REDIS_URL ? 'CONFIGURED' : 'NOT_CONFIGURED' },
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
