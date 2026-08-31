import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { generateAiText, getAiProviderInfo } from '../services/ai-provider.service.js';
import { completeAiUsage, reserveAiUsage } from '../services/ai-usage.service.js';
import { applyReplanProposal, buildReplanProposal, coachContextFromIntelligence, getLearningIntelligence } from '../services/learning-intelligence.service.js';

const applySchema = z.object({ changes: z.array(z.object({ lessonId: z.string().min(1), proposedScheduledAt: z.coerce.date() })).min(1).max(50) });
const coachSchema = z.object({ message: z.string().trim().min(2).max(3000).optional() });

export async function getIntelligenceOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getLearningIntelligence(req.user!.id)); }
  catch (error) { next(error); }
}

export async function getLearningCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86_400_000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 35 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return res.status(400).json({ message: 'Invalid calendar date range.' });
    const lessons = await LessonModel.find({ ownerId: req.user!.id, scheduledAt: { $gte: from, $lte: to } }).sort({ scheduledAt: 1 }).select('title status scheduledAt durationMinutes learningPathId moduleId').lean();
    res.json(lessons.map(lesson => ({ id: String(lesson._id), title: lesson.title, status: lesson.status, scheduledAt: lesson.scheduledAt, durationMinutes: lesson.durationMinutes, learningPathId: String(lesson.learningPathId), moduleId: String(lesson.moduleId) })));
  } catch (error) { next(error); }
}

export async function progressCoach(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const input = coachSchema.parse(req.body ?? {});
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI progress coaching is not configured for ${provider.provider}.` });
    const usage = await reserveAiUsage(req.user!.id, req.user!.role, 'COACH', { mode: 'progress-intelligence' });
    usageId = usage.id;
    const intelligence = await getLearningIntelligence(req.user!.id);
    const prompt = `You are the LearnFlow progress coach. Analyse the learner's real tracked progress below. Give a concise weekly review with: 1) what went well, 2) the main consistency risk, 3) the highest-value focus for the next seven days, and 4) one realistic scheduling adjustment. Never invent activity and never claim data was changed.\n\nTracked learner data:\n${coachContextFromIntelligence(intelligence)}\n\nLearner question:\n${input.message ?? 'Give me my weekly learning review and next-week focus.'}`;
    const answer = await generateAiText(prompt);
    await completeAiUsage(usage.id, 'SUCCEEDED');
    res.json({ answer, provider: provider.provider, model: provider.model });
  } catch (error) {
    if (usageId) await completeAiUsage(usageId, 'FAILED', { errorMessage: error instanceof Error ? error.message : 'Progress coaching failed' }).catch(() => undefined);
    next(error);
  }
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
