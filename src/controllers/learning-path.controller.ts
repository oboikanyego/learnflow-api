import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LearningPathService } from '../services/learning-path.service.js';
import { cachedJson, invalidateLearningCache, redisKeys } from '../services/redis.service.js';

const status = z.enum(['BACKLOG', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);
const createSchema = z.object({ title: z.string().trim().min(2).max(150), description: z.string().trim().max(1000).optional(), status: status.optional() });
const updateSchema = createSchema.partial();
const idSchema = z.string().min(1);
const param = (value: string | string[] | undefined): string => idSchema.parse(typeof value === 'string' ? value : undefined);
const service = new LearningPathService();

export async function listLearningPaths(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    res.json(await cachedJson(redisKeys.learningPaths(ownerId), 60, () => service.list(ownerId)));
  } catch (error) { next(error); }
}

export async function getLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const learningPathId = param(req.params.id);
    res.json(await cachedJson(redisKeys.learningPath(ownerId, learningPathId), 120, () => service.get(ownerId, learningPathId)));
  } catch (error) { next(error); }
}

export async function createLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const path = await service.create(ownerId, createSchema.parse(req.body));
    await invalidateLearningCache(ownerId);
    res.status(201).json(path);
  } catch (error) { next(error); }
}

export async function updateLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const learningPathId = param(req.params.id);
    const path = await service.update(ownerId, learningPathId, updateSchema.parse(req.body));
    await invalidateLearningCache(ownerId, { learningPathId });
    res.json(path);
  } catch (error) { next(error); }
}

export async function deleteLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const learningPathId = param(req.params.id);
    await service.remove(ownerId, learningPathId);
    await invalidateLearningCache(ownerId, { learningPathId });
    res.status(204).send();
  } catch (error) { next(error); }
}
