import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';

const DAY = 86_400_000;
const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const reviewSchema = z.object({ confidenceScore: z.number().int().min(1).max(5) });

function intervalDays(stage: number, confidence: number) {
  if (confidence <= 2) return 1;
  const intervals = confidence === 3 ? [1, 3, 7, 14, 30, 60] : [3, 7, 14, 30, 60, 120];
  const index = Math.min(stage, intervals.length - 1);
  return intervals[index] ?? intervals.at(-1) ?? 1;
}

export function nextReviewDate(stage: number, confidence: number, now = new Date()) { return new Date(now.getTime() + intervalDays(stage, confidence) * DAY); }

export async function listReviewQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id; const now = new Date();
    const lessons = await LessonModel.find({ ownerId, status: 'COMPLETED', nextReviewAt: { $exists: true } }).sort({ nextReviewAt: 1, confidenceScore: 1 }).select('title description resourceUrl learningPathId moduleId confidenceScore reviewStage nextReviewAt lastReviewedAt reviewCount completedAt masteryScore assessmentAttempts lastAssessedAt').lean();
    const due = lessons.filter(item => item.nextReviewAt && new Date(item.nextReviewAt) <= now);
    res.json({ generatedAt: now.toISOString(), dueCount: due.length, weakCount: lessons.filter(item => (item.confidenceScore ?? 3) <= 2 || (item.masteryScore !== undefined && item.masteryScore < 70)).length, averageConfidence: lessons.length ? Number((lessons.reduce((sum, item) => sum + (item.confidenceScore ?? 3), 0) / lessons.length).toFixed(1)) : 0, due, upcoming: lessons.filter(item => item.nextReviewAt && new Date(item.nextReviewAt) > now).slice(0, 12) });
  } catch (error) { next(error); }
}

export async function completeReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id; const lessonId = idSchema.parse(req.params.lessonId); const input = reviewSchema.parse(req.body);
    const lesson = await LessonModel.findOne({ _id: lessonId, ownerId, status: 'COMPLETED' });
    if (!lesson) return res.status(404).json({ message: 'Completed lesson not found' });
    const now = new Date(); const nextStage = input.confidenceScore <= 2 ? 0 : Math.min(10, (lesson.reviewStage ?? 0) + 1);
    lesson.confidenceScore = input.confidenceScore; lesson.reviewStage = nextStage; lesson.lastReviewedAt = now; lesson.reviewCount = (lesson.reviewCount ?? 0) + 1; lesson.nextReviewAt = nextReviewDate(nextStage, input.confidenceScore, now); await lesson.save(); res.json(lesson);
  } catch (error) { next(error); }
}

export async function getRetentionSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id; const now = new Date();
    const lessons = await LessonModel.find({ ownerId, status: 'COMPLETED' }).select('confidenceScore nextReviewAt reviewCount masteryScore assessmentAttempts').lean();
    const rated = lessons.filter(item => item.confidenceScore);
    res.json({ completedLessons: lessons.length, ratedLessons: rated.length, dueReviews: lessons.filter(item => item.nextReviewAt && new Date(item.nextReviewAt) <= now).length, weakLessons: rated.filter(item => (item.confidenceScore ?? 3) <= 2 || (item.masteryScore !== undefined && item.masteryScore < 70)).length, averageConfidence: rated.length ? Number((rated.reduce((sum, item) => sum + (item.confidenceScore ?? 0), 0) / rated.length).toFixed(1)) : 0, reviewsCompleted: lessons.reduce((sum, item) => sum + (item.reviewCount ?? 0), 0), assessedLessons: lessons.filter(item => (item.assessmentAttempts ?? 0) > 0).length });
  } catch (error) { next(error); }
}
