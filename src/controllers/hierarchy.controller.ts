import type { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel, lessonStatuses } from '../models/lesson.model.js';
import { cachedJson, invalidateLearningCache, redisKeys } from '../services/redis.service.js';

const id = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const param = (value: string | string[] | undefined): string => id.parse(typeof value === 'string' ? value : undefined);
const createPhaseSchema = z.object({ title: z.string().min(2).max(150), description: z.string().max(1000).optional(), position: z.number().int().min(0).optional() });
const createModuleSchema = createPhaseSchema;
const createLessonSchema = z.object({ title: z.string().min(2).max(180), description: z.string().max(2000).optional(), resourceUrl: z.string().url().optional(), position: z.number().int().min(0).optional(), durationMinutes: z.number().int().min(5).max(480).optional() });
const patchLessonSchema = z.object({ title: z.string().min(2).max(180).optional(), description: z.string().max(2000).optional(), resourceUrl: z.string().url().nullable().optional(), position: z.number().int().min(0).optional(), status: z.enum(lessonStatuses).optional(), scheduledAt: z.coerce.date().nullable().optional(), durationMinutes: z.number().int().min(5).max(480).optional(), reminderMinutes: z.number().int().min(0).max(10080).optional(), evidenceUrl: z.string().url().nullable().optional(), notes: z.string().max(5000).optional() });

async function ownsPath(ownerId: string, learningPathId: string) { return LearningPathModel.exists({ _id: learningPathId, ownerId }); }

export async function getHierarchy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const learningPathId = param(req.params.learningPathId);
    if (!(await ownsPath(ownerId, learningPathId))) return res.status(404).json({ message: 'Learning path not found' });

    const hierarchy = await cachedJson(redisKeys.hierarchy(ownerId, learningPathId), 120, async () => {
      const [phases, modules, lessons] = await Promise.all([
        PhaseModel.find({ ownerId, learningPathId }).sort({ position: 1 }).lean(),
        ModuleModel.find({ ownerId, learningPathId }).sort({ position: 1 }).lean(),
        LessonModel.find({ ownerId, learningPathId }).sort({ position: 1 }).lean()
      ]);
      return phases.map(phase => ({
        ...phase,
        modules: modules.filter(module => String(module.phaseId) === String(phase._id)).map(module => ({
          ...module,
          lessons: lessons.filter(lesson => String(lesson.moduleId) === String(module._id))
        }))
      }));
    });

    res.json(hierarchy);
  } catch (error) { next(error); }
}

export async function getLesson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = param(req.params.lessonId);
    const lesson = await cachedJson(redisKeys.lesson(ownerId, lessonId), 60, () => LessonModel.findOne({ _id: lessonId, ownerId }).lean());
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json(lesson);
  } catch (error) { next(error); }
}

export async function createPhase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const learningPathId = param(req.params.learningPathId);
    if (!(await ownsPath(ownerId, learningPathId))) return res.status(404).json({ message: 'Learning path not found' });
    const input = createPhaseSchema.parse(req.body);
    const position = input.position ?? await PhaseModel.countDocuments({ ownerId, learningPathId });
    const phase = await PhaseModel.create({ ...input, position, ownerId, learningPathId });
    await invalidateLearningCache(ownerId, { learningPathId, invalidatePathList: false, invalidateAnalytics: false });
    res.status(201).json(phase);
  } catch (error) { next(error); }
}

export async function createModule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const phaseId = param(req.params.phaseId);
    const phase = await PhaseModel.findOne({ _id: phaseId, ownerId });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    const input = createModuleSchema.parse(req.body);
    const position = input.position ?? await ModuleModel.countDocuments({ ownerId, phaseId });
    const module = await ModuleModel.create({ ...input, position, ownerId, phaseId, learningPathId: phase.learningPathId });
    await invalidateLearningCache(ownerId, { learningPathId: String(phase.learningPathId), invalidatePathList: false, invalidateAnalytics: false });
    res.status(201).json(module);
  } catch (error) { next(error); }
}

export async function createLesson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const moduleId = param(req.params.moduleId);
    const module = await ModuleModel.findOne({ _id: moduleId, ownerId });
    if (!module) return res.status(404).json({ message: 'Module not found' });
    const input = createLessonSchema.parse(req.body);
    const position = input.position ?? await LessonModel.countDocuments({ ownerId, moduleId });
    const lesson = await LessonModel.create({ ...input, position, ownerId, moduleId, phaseId: module.phaseId, learningPathId: module.learningPathId });
    await invalidateLearningCache(ownerId, { learningPathId: String(module.learningPathId), lessonId: lesson.id, invalidatePathList: false });
    res.status(201).json(lesson);
  } catch (error) { next(error); }
}

export async function patchLesson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = param(req.params.lessonId);
    const input = patchLessonSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...input };
    if (input.status === 'COMPLETED') patch.completedAt = new Date();
    if (input.status && input.status !== 'COMPLETED') patch.completedAt = null;
    if (input.scheduledAt) patch.status = input.status ?? 'SCHEDULED';
    if (input.scheduledAt === null) patch.reminderSentAt = null;
    const lesson = await LessonModel.findOneAndUpdate({ _id: lessonId, ownerId }, patch, { new: true, runValidators: true });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    await invalidateLearningCache(ownerId, { learningPathId: String(lesson.learningPathId), lessonId, invalidatePathList: false });
    res.json(lesson);
  } catch (error) { next(error); }
}

export async function deletePhase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const phaseId = param(req.params.phaseId);
    const phase = await PhaseModel.findOneAndDelete({ _id: phaseId, ownerId });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    await Promise.all([ModuleModel.deleteMany({ ownerId, phaseId }), LessonModel.deleteMany({ ownerId, phaseId })]);
    await invalidateLearningCache(ownerId, { learningPathId: String(phase.learningPathId), invalidatePathList: false });
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function deleteModule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const moduleId = param(req.params.moduleId);
    const module = await ModuleModel.findOneAndDelete({ _id: moduleId, ownerId });
    if (!module) return res.status(404).json({ message: 'Module not found' });
    await LessonModel.deleteMany({ ownerId, moduleId });
    await invalidateLearningCache(ownerId, { learningPathId: String(module.learningPathId), invalidatePathList: false });
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function deleteLesson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = param(req.params.lessonId);
    const lesson = await LessonModel.findOneAndDelete({ _id: lessonId, ownerId });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    await invalidateLearningCache(ownerId, { learningPathId: String(lesson.learningPathId), lessonId, invalidatePathList: false });
    res.status(204).send();
  } catch (error) { next(error); }
}
