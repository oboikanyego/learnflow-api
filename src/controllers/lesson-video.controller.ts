import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { findLessonVideos, saveLessonVideoResource, searchUserLessons } from '../services/lesson-video.service.js';

const lessonSearchSchema = z.object({
  q: z.string().trim().max(120).optional()
});

const videoSearchSchema = z.object({
  lessonId: z.string().min(1),
  query: z.string().trim().max(120).optional()
});

const saveVideoSchema = z.object({
  lessonId: z.string().min(1),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid YouTube video id')
});

export async function listVideoLessons(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = lessonSearchSchema.parse(req.query);
    res.json(await searchUserLessons(req.user!.id, input.q ?? ''));
  } catch (error) {
    next(error);
  }
}

export async function searchLessonVideos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = videoSearchSchema.parse(req.body);
    res.json(await findLessonVideos(req.user!.id, input.lessonId, input.query ?? ''));
  } catch (error) {
    next(error);
  }
}

export async function saveVideoAsLessonResource(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = saveVideoSchema.parse(req.body);
    res.json(await saveLessonVideoResource(req.user!.id, input.lessonId, input.videoId));
  } catch (error) {
    next(error);
  }
}
