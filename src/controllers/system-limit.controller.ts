import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { listSystemLimits, updateSystemLimit } from '../services/system-limit.service.js';

const updateLimitSchema = z.object({ value: z.number().int().nonnegative() });

export async function getSystemLimits(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json(await listSystemLimits());
  } catch (error) {
    next(error);
  }
}

export async function patchSystemLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { value } = updateLimitSchema.parse(req.body);
    res.json(await updateSystemLimit(String(req.params.key), value, req.user!.id));
  } catch (error) {
    next(error);
  }
}
