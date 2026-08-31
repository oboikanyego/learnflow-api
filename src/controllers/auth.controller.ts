import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { authService } from '../services/auth.service.js';
import { isValidTimeZone } from '../utils/timezone.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
  timezone: z.string().refine(isValidTimeZone, 'Invalid IANA timezone').default('UTC')
});
const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(128) });
const forgotPasswordSchema = z.object({ email: z.email() });
const resetPasswordSchema = z.object({ token: z.string().min(32), password: z.string().min(8).max(128) });
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z.string().refine(isValidTimeZone, 'Invalid IANA timezone')
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128)
});
const notificationPreferencesSchema = z.object({
  inAppReminders: z.boolean(),
  emailReminders: z.boolean(),
  reminderMinutes: z.number().int().min(5).max(1440),
  missedSessionEmails: z.boolean(),
  celebrationEmails: z.boolean(),
  weeklyReviewEmails: z.boolean()
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await authService.register(registerSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function login(req: Request, res: Response, next: NextFunction) {
  try { const input = loginSchema.parse(req.body); res.json(await authService.login(input.email, input.password)); } catch (error) { next(error); }
}
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try { const input = forgotPasswordSchema.parse(req.body); res.json(await authService.forgotPassword(input.email)); } catch (error) { next(error); }
}
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try { const input = resetPasswordSchema.parse(req.body); res.json(await authService.resetPassword(input.token, input.password)); } catch (error) { next(error); }
}
export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await authService.me(req.user!.id)); } catch (error) { next(error); }
}
export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await authService.updateProfile(req.user!.id, profileSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { const input = changePasswordSchema.parse(req.body); res.json(await authService.changePassword(req.user!.id, input.currentPassword, input.newPassword)); } catch (error) { next(error); }
}
export async function updateNotificationPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await authService.updateNotificationPreferences(req.user!.id, notificationPreferencesSchema.parse(req.body))); } catch (error) { next(error); }
}
