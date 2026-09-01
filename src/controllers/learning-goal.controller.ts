import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LearningGoalModel } from '../models/learning-goal.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';

const goalSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1200).optional(),
  learningPathId: z.string().refine(Types.ObjectId.isValid).nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  weeklyMinutesTarget: z.number().int().min(30).max(10080).default(360),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional()
});

async function goalWithProgress(ownerId: string, goal: any) {
  let progress = 0;
  let completedLessons = 0;
  let totalLessons = 0;
  if (goal.learningPathId) {
    [totalLessons, completedLessons] = await Promise.all([
      LessonModel.countDocuments({ ownerId, learningPathId: goal.learningPathId }),
      LessonModel.countDocuments({ ownerId, learningPathId: goal.learningPathId, status: 'COMPLETED' })
    ]);
    progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  }
  return { ...goal, progress, completedLessons, totalLessons };
}

export async function listGoals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const goals = await LearningGoalModel.find({ ownerId: req.user!.id }).sort({ status: 1, targetDate: 1, createdAt: -1 }).lean();
    res.json(await Promise.all(goals.map(goal => goalWithProgress(req.user!.id, goal))));
  } catch (error) { next(error); }
}

export async function createGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = goalSchema.parse(req.body);
    if (input.learningPathId) {
      const path = await LearningPathModel.exists({ _id: input.learningPathId, ownerId: req.user!.id });
      if (!path) return res.status(404).json({ message: 'Learning path not found' });
    }
    const goal = await LearningGoalModel.create({ ...input, learningPathId: input.learningPathId || undefined, targetDate: input.targetDate || undefined, ownerId: req.user!.id });
    res.status(201).json(await goalWithProgress(req.user!.id, goal.toObject()));
  } catch (error) { next(error); }
}

export async function updateGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = goalSchema.partial().parse(req.body);
    if (input.learningPathId) {
      const path = await LearningPathModel.exists({ _id: input.learningPathId, ownerId: req.user!.id });
      if (!path) return res.status(404).json({ message: 'Learning path not found' });
    }

    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === null && (key === 'learningPathId' || key === 'targetDate')) unset[key] = 1;
      else if (value !== undefined) set[key] = value;
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const goal = await LearningGoalModel.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!.id },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!goal) return res.status(404).json({ message: 'Learning goal not found' });
    res.json(await goalWithProgress(req.user!.id, goal));
  } catch (error) { next(error); }
}

export async function deleteGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const goal = await LearningGoalModel.findOneAndDelete({ _id: req.params.id, ownerId: req.user!.id });
    if (!goal) return res.status(404).json({ message: 'Learning goal not found' });
    res.status(204).send();
  } catch (error) { next(error); }
}
