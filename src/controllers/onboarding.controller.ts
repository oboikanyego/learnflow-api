import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';

const onboardingSchema = z.object({
  learningGoal: z.string().trim().min(3).max(160),
  weeklyMinutesTarget: z.number().int().min(30).max(10080),
  preferredDays: z.array(z.string().trim().min(2).max(20)).min(1).max(7),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  targetDate: z.coerce.date().nullable().optional()
});

export async function getOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.id).select('onboarding').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ completed: Boolean(user.onboarding?.completedAt), onboarding: user.onboarding ?? null });
  } catch (error) { next(error); }
}

export async function completeOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = onboardingSchema.parse(req.body);
    const onboarding = {
      ...input,
      targetDate: input.targetDate ?? undefined,
      completedAt: new Date()
    };
    const user = await UserModel.findByIdAndUpdate(req.user!.id, { $set: { onboarding } }, { new: true }).select('onboarding').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ completed: true, onboarding: user.onboarding });
  } catch (error) { next(error); }
}
