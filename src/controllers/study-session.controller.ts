import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { StudySessionModel } from '../models/study-session.model.js';

const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const reflectionSchema = z.object({ reflection: z.string().trim().max(3000).optional() });

function elapsedNow(session: { status: string; elapsedSeconds: number; lastResumedAt?: Date | null }) {
  if (session.status !== 'ACTIVE' || !session.lastResumedAt) return session.elapsedSeconds || 0;
  return (session.elapsedSeconds || 0) + Math.max(0, Math.floor((Date.now() - new Date(session.lastResumedAt).getTime()) / 1000));
}

async function ownedLesson(ownerId: string, lessonId: string) {
  return LessonModel.findOne({ _id: lessonId, ownerId });
}

export async function startStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = idSchema.parse(req.params.lessonId);
    const lesson = await ownedLesson(ownerId, lessonId);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const existing = await StudySessionModel.findOne({ ownerId, lessonId, status: { $in: ['ACTIVE','PAUSED'] } }).sort({ createdAt: -1 });
    if (existing) return res.json({ ...existing.toObject(), elapsedSeconds: elapsedNow(existing) });

    const now = new Date();
    const session = await StudySessionModel.create({ ownerId, lessonId, learningPathId: lesson.learningPathId, status: 'ACTIVE', startedAt: now, lastResumedAt: now });
    if (lesson.status !== 'COMPLETED') await LessonModel.updateOne({ _id: lessonId, ownerId }, { $set: { status: 'IN_PROGRESS' } });
    res.status(201).json(session);
  } catch (error) { next(error); }
}

export async function pauseStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const sessionId = idSchema.parse(req.params.sessionId);
    const session = await StudySessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) return res.status(404).json({ message: 'Study session not found' });
    if (session.status !== 'ACTIVE') return res.json(session);
    session.elapsedSeconds = elapsedNow(session);
    session.status = 'PAUSED';
    session.pauseCount += 1;
    session.lastResumedAt = undefined;
    await session.save();
    res.json(session);
  } catch (error) { next(error); }
}

export async function resumeStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const sessionId = idSchema.parse(req.params.sessionId);
    const session = await StudySessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) return res.status(404).json({ message: 'Study session not found' });
    if (session.status === 'PAUSED') { session.status = 'ACTIVE'; session.lastResumedAt = new Date(); await session.save(); }
    res.json({ ...session.toObject(), elapsedSeconds: elapsedNow(session) });
  } catch (error) { next(error); }
}

export async function completeStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const sessionId = idSchema.parse(req.params.sessionId);
    const input = reflectionSchema.parse(req.body ?? {});
    const session = await StudySessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) return res.status(404).json({ message: 'Study session not found' });
    if (session.status === 'ACTIVE') session.elapsedSeconds = elapsedNow(session);
    session.status = 'COMPLETED';
    session.endedAt = new Date();
    session.lastResumedAt = undefined;
    if (input.reflection !== undefined) session.reflection = input.reflection;
    await session.save();
    await LessonModel.updateOne({ _id: session.lessonId, ownerId }, { $set: { status: 'COMPLETED', completedAt: session.endedAt } });
    res.json(session);
  } catch (error) { next(error); }
}

export async function abandonStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const sessionId = idSchema.parse(req.params.sessionId);
    const session = await StudySessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) return res.status(404).json({ message: 'Study session not found' });
    if (session.status === 'ACTIVE') session.elapsedSeconds = elapsedNow(session);
    session.status = 'ABANDONED'; session.endedAt = new Date(); session.lastResumedAt = undefined; await session.save();
    res.json(session);
  } catch (error) { next(error); }
}

export async function getActiveStudySession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = idSchema.parse(req.params.lessonId);
    const session = await StudySessionModel.findOne({ ownerId, lessonId, status: { $in: ['ACTIVE','PAUSED'] } }).sort({ createdAt: -1 }).lean();
    res.json(session ? { ...session, elapsedSeconds: elapsedNow(session) } : null);
  } catch (error) { next(error); }
}

export async function listStudySessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const sessions = await StudySessionModel.find({ ownerId }).sort({ startedAt: -1 }).limit(100).lean();
    const lessonIds = [...new Set(sessions.map(item => String(item.lessonId)))];
    const lessons = await LessonModel.find({ ownerId, _id: { $in: lessonIds } }).select('title').lean();
    const lessonMap = new Map(lessons.map(item => [String(item._id), item.title]));
    res.json(sessions.map(item => ({ ...item, lessonTitle: lessonMap.get(String(item.lessonId)) ?? 'Lesson' })));
  } catch (error) { next(error); }
}
