import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

vi.mock('../models/learning-path.model.js', () => ({ LearningPathModel: { exists: vi.fn() } }));
vi.mock('../models/phase.model.js', () => ({ PhaseModel: { findOneAndDelete: vi.fn(), find: vi.fn(), create: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../models/module.model.js', () => ({ ModuleModel: { findOneAndDelete: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({
  LessonModel: { findOneAndDelete: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn(), distinct: vi.fn(), findOneAndUpdate: vi.fn() },
  lessonStatuses: ['BACKLOG', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'SKIPPED']
}));
vi.mock('../models/study-session.model.js', () => ({ StudySessionModel: { deleteMany: vi.fn() } }));
vi.mock('../models/lesson-comment.model.js', () => ({ LessonCommentModel: { deleteMany: vi.fn() } }));
vi.mock('../services/redis.service.js', () => ({ cachedJson: vi.fn(), invalidateLearningCache: vi.fn(), redisKeys: { hierarchy: vi.fn(), lesson: vi.fn() } }));

import { deleteLesson, deleteModule, deletePhase } from './hierarchy.controller.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { StudySessionModel } from '../models/study-session.model.js';
import { LessonCommentModel } from '../models/lesson-comment.model.js';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(params: Record<string, string>): AuthenticatedRequest {
  return { user: { id: 'user-1', role: 'learner' }, params } as unknown as AuthenticatedRequest;
}

// param() validates req.params values as Mongo ObjectIds, so tests must use valid-looking hex ids.
const PHASE_ID = '507f1f77bcf86cd799439011';
const MODULE_ID = '507f1f77bcf86cd799439012';
const LESSON_ID = '507f1f77bcf86cd799439013';
const OTHER_LESSON_ID = '507f1f77bcf86cd799439014';
const MISSING_ID = '507f1f77bcf86cd799439099';

describe('deletePhase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cascades to modules, lessons, study sessions and comments under the phase', async () => {
    vi.mocked(PhaseModel.findOneAndDelete).mockResolvedValue({ _id: PHASE_ID, learningPathId: 'path-1' } as never);
    vi.mocked(LessonModel.distinct).mockResolvedValue([LESSON_ID, OTHER_LESSON_ID] as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePhase(mockReq({ phaseId: PHASE_ID }), res, next);

    expect(LessonModel.distinct).toHaveBeenCalledWith('_id', { ownerId: 'user-1', phaseId: PHASE_ID });
    expect(ModuleModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', phaseId: PHASE_ID });
    expect(LessonModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', phaseId: PHASE_ID });
    expect(StudySessionModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: [LESSON_ID, OTHER_LESSON_ID] } });
    expect(LessonCommentModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: [LESSON_ID, OTHER_LESSON_ID] } });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('returns 404 and does not cascade when the phase does not belong to this owner', async () => {
    vi.mocked(PhaseModel.findOneAndDelete).mockResolvedValue(null as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePhase(mockReq({ phaseId: MISSING_ID }), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(LessonModel.distinct).not.toHaveBeenCalled();
    expect(StudySessionModel.deleteMany).not.toHaveBeenCalled();
  });
});

describe('deleteModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cascades to lessons, study sessions and comments under the module', async () => {
    vi.mocked(ModuleModel.findOneAndDelete).mockResolvedValue({ _id: MODULE_ID, learningPathId: 'path-1' } as never);
    vi.mocked(LessonModel.distinct).mockResolvedValue([LESSON_ID] as never);
    const res = mockRes();
    const next = vi.fn();

    await deleteModule(mockReq({ moduleId: MODULE_ID }), res, next);

    expect(LessonModel.distinct).toHaveBeenCalledWith('_id', { ownerId: 'user-1', moduleId: MODULE_ID });
    expect(LessonModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', moduleId: MODULE_ID });
    expect(StudySessionModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: [LESSON_ID] } });
    expect(LessonCommentModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: [LESSON_ID] } });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('deleteLesson', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cascades to study sessions and comments for the deleted lesson', async () => {
    vi.mocked(LessonModel.findOneAndDelete).mockResolvedValue({ _id: LESSON_ID, learningPathId: 'path-1' } as never);
    const res = mockRes();
    const next = vi.fn();

    await deleteLesson(mockReq({ lessonId: LESSON_ID }), res, next);

    expect(StudySessionModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: LESSON_ID });
    expect(LessonCommentModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: LESSON_ID });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('returns 404 and does not cascade when the lesson does not belong to this owner', async () => {
    vi.mocked(LessonModel.findOneAndDelete).mockResolvedValue(null as never);
    const res = mockRes();
    const next = vi.fn();

    await deleteLesson(mockReq({ lessonId: MISSING_ID }), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(StudySessionModel.deleteMany).not.toHaveBeenCalled();
    expect(LessonCommentModel.deleteMany).not.toHaveBeenCalled();
  });
});
