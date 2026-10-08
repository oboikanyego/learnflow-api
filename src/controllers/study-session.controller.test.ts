import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

vi.mock('../models/lesson.model.js', () => ({ LessonModel: { find: vi.fn(), updateOne: vi.fn() } }));
vi.mock('../models/study-session.model.js', () => ({ StudySessionModel: { find: vi.fn() } }));
vi.mock('../services/redis.service.js', () => ({ invalidateLearningCache: vi.fn() }));
vi.mock('./retention.controller.js', () => ({ nextReviewDate: vi.fn() }));

import { listStudySessions } from './study-session.controller.js';
import { LessonModel } from '../models/lesson.model.js';
import { StudySessionModel } from '../models/study-session.model.js';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(): AuthenticatedRequest {
  return { user: { id: 'user-1', role: 'learner' }, params: {} } as unknown as AuthenticatedRequest;
}

describe('listStudySessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops sessions whose lesson no longer exists instead of mislabelling them', async () => {
    const sort = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const lean = vi.fn().mockResolvedValue([
      { _id: 's1', lessonId: 'lesson-live', startedAt: new Date() },
      { _id: 's2', lessonId: 'lesson-deleted', startedAt: new Date() }
    ]);
    vi.mocked(StudySessionModel.find).mockReturnValue({ sort, limit, lean } as never);
    vi.mocked(LessonModel.find).mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: 'lesson-live', title: 'Intro to hooks' }]) }) } as never);
    const res = mockRes();
    const next = vi.fn();

    await listStudySessions(mockReq(), res, next);

    const [payload] = vi.mocked(res.json).mock.calls[0]!;
    expect(payload).toEqual([{ _id: 's1', lessonId: 'lesson-live', startedAt: expect.any(Date), lessonTitle: 'Intro to hooks' }]);
  });

  it('returns an empty list when every session belongs to a deleted lesson', async () => {
    const sort = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const lean = vi.fn().mockResolvedValue([{ _id: 's1', lessonId: 'lesson-deleted', startedAt: new Date() }]);
    vi.mocked(StudySessionModel.find).mockReturnValue({ sort, limit, lean } as never);
    vi.mocked(LessonModel.find).mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as never);
    const res = mockRes();
    const next = vi.fn();

    await listStudySessions(mockReq(), res, next);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});
