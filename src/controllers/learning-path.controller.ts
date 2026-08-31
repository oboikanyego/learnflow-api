import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LearningPathService } from '../services/learning-path.service.js';

const createSchema = z.object({ title: z.string().min(2).max(150), description: z.string().max(1000).optional() });
const service = new LearningPathService();

export async function listLearningPaths(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.list()); } catch (error) { next(error); }
}

export async function createLearningPath(req: Request, res: Response, next: NextFunction) {
  try { const input = createSchema.parse(req.body); res.status(201).json(await service.create(input)); } catch (error) { next(error); }
}
