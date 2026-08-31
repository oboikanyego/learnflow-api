import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LearningPathService } from '../services/learning-path.service.js';

const status = z.enum(['BACKLOG', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);
const createSchema = z.object({ title: z.string().trim().min(2).max(150), description: z.string().trim().max(1000).optional(), status: status.optional() });
const updateSchema = createSchema.partial();
const idSchema = z.string().min(1);
const param = (value: string | string[] | undefined): string => idSchema.parse(typeof value === 'string' ? value : undefined);
const service = new LearningPathService();

export async function listLearningPaths(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json(await service.list(req.user!.id)); } catch (error) { next(error); } }
export async function getLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json(await service.get(req.user!.id, param(req.params.id))); } catch (error) { next(error); } }
export async function createLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.status(201).json(await service.create(req.user!.id, createSchema.parse(req.body))); } catch (error) { next(error); } }
export async function updateLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json(await service.update(req.user!.id, param(req.params.id), updateSchema.parse(req.body))); } catch (error) { next(error); } }
export async function deleteLearningPath(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { await service.remove(req.user!.id, param(req.params.id)); res.status(204).send(); } catch (error) { next(error); } }
