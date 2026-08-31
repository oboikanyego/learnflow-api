import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { applyReplanProposal, buildReplanProposal, getLearningIntelligence } from '../services/learning-intelligence.service.js';

const applySchema = z.object({
  changes: z.array(z.object({ lessonId: z.string().min(1), proposedScheduledAt: z.coerce.date() })).min(1).max(50)
});

export async function getIntelligenceOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getLearningIntelligence(req.user!.id)); }
  catch (error) { next(error); }
}

export async function getLearningCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86_400_000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 35 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return res.status(400).json({ message: 'Invalid calendar date range.' });
    const lessons = await LessonModel.find({ ownerId: req.user!.id, scheduledAt: { $gte: from, $lte: to } })
      .sort({ scheduledAt: 1 }).select('title status scheduledAt durationMinutes learningPathId moduleId').lean();
    res.json(lessons.map(lesson => ({ id: String(lesson._id), title: lesson.title, status: lesson.status, scheduledAt: lesson.scheduledAt, durationMinutes: lesson.durationMinutes, learningPathId: String(lesson.learningPathId), moduleId: String(lesson.moduleId) })));
  } catch (error) { next(error); }
}

export async function proposeReplan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await buildReplanProposal(req.user!.id)); }
  catch (error) { next(error); }
}

export async function applyReplan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = applySchema.parse(req.body);
    const changes = input.changes.map(change => ({ lessonId: change.lessonId, proposedScheduledAt: change.proposedScheduledAt.toISOString() }));
    res.json(await applyReplanProposal(req.user!.id, changes));
  } catch (error) { next(error); }
}
