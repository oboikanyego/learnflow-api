import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { createUserMessage } from '../services/user-message.service.js';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(2).max(160).default('LearnFlow enquiry'),
  message: z.string().trim().min(5).max(5000)
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(['GENERAL', 'USABILITY', 'AI', 'LEARNING', 'VIDEO', 'OTHER']).default('GENERAL'),
  subject: z.string().trim().min(2).max(160).default('LearnFlow feedback'),
  message: z.string().trim().min(5).max(5000)
});

const supportSchema = z.object({
  category: z.enum(['ACCOUNT', 'BILLING', 'AI', 'LEARNING', 'VIDEO', 'TECHNICAL', 'OTHER']).default('TECHNICAL'),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(5000)
});

export async function submitContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = contactSchema.parse(req.body);
    const record = await createUserMessage({ type: 'CONTACT', ...input });
    res.status(201).json({ id: String(record._id), message: 'Thanks — your message has been received.', notificationStatus: record.notificationStatus });
  } catch (error) { next(error); }
}

export async function submitFeedback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = feedbackSchema.parse(req.body);
    const user = await UserModel.findById(req.user!.id).select('name email').lean();
    if (!user) return res.status(404).json({ message: 'User account not found.' });
    const record = await createUserMessage({ type: 'FEEDBACK', userId: req.user!.id, name: user.name, email: user.email, ...input });
    res.status(201).json({ id: String(record._id), message: 'Thank you for rating LearnFlow. Your feedback has been received.', notificationStatus: record.notificationStatus });
  } catch (error) { next(error); }
}

export async function submitSupport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = supportSchema.parse(req.body);
    const user = await UserModel.findById(req.user!.id).select('name email').lean();
    if (!user) return res.status(404).json({ message: 'User account not found.' });
    const record = await createUserMessage({ type: 'SUPPORT', userId: req.user!.id, name: user.name, email: user.email, ...input });
    res.status(201).json({ id: String(record._id), message: 'Your support request has been received.', notificationStatus: record.notificationStatus });
  } catch (error) { next(error); }
}
