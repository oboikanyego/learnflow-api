import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { LessonCommentModel } from '../models/lesson-comment.model.js';
import { UserModel } from '../models/user.model.js';

const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const bodySchema = z.object({ body: z.string().trim().min(1).max(3000) });
const parseId = (value: string | string[] | undefined): string => idSchema.parse(typeof value === 'string' ? value : undefined);

export async function listLessonComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = parseId(req.params.lessonId);
    const lesson = await LessonModel.exists({ _id: lessonId, ownerId });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    const comments = await LessonCommentModel.find({ ownerId, lessonId }).sort({ createdAt: 1 }).lean();
    res.json(comments);
  } catch (error) { next(error); }
}

export async function addLessonComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = parseId(req.params.lessonId);
    const lesson = await LessonModel.exists({ _id: lessonId, ownerId });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    const input = bodySchema.parse(req.body);
    const user = await UserModel.findById(ownerId).select('name').lean();
    if (!user) return res.status(401).json({ message: 'User not found' });
    const comment = await LessonCommentModel.create({ ownerId, lessonId, authorId: ownerId, authorName: user.name, body: input.body });
    res.status(201).json(comment);
  } catch (error) { next(error); }
}
