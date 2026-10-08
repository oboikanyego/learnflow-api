import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/lesson.model.js', () => ({ LessonModel: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock('../models/ai-action-audit.model.js', () => ({ AiActionAuditModel: { create: vi.fn(), find: vi.fn() } }));

import { applyReplanProposal, listAiActionAudit } from './learning-intelligence.service.js';
import { LessonModel } from '../models/lesson.model.js';
import { AiActionAuditModel } from '../models/ai-action-audit.model.js';

describe('applyReplanProposal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the lesson and writes an audit record tagged with the given source', async () => {
    const previousScheduledAt = new Date('2024-06-01T10:00:00.000Z');
    vi.mocked(LessonModel.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue({ title: 'Intro to hooks', scheduledAt: previousScheduledAt }) } as never);
    vi.mocked(LessonModel.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);
    vi.mocked(AiActionAuditModel.create).mockResolvedValue({} as never);

    const result = await applyReplanProposal('user-1', [{ lessonId: 'lesson-1', proposedScheduledAt: '2024-06-11T18:00:00.000Z' }], 'COACH');

    expect(LessonModel.updateOne).toHaveBeenCalledWith(
      { _id: 'lesson-1', ownerId: 'user-1' },
      { $set: { scheduledAt: new Date('2024-06-11T18:00:00.000Z'), status: 'SCHEDULED', reminderSentAt: null, missedAt: null } }
    );
    expect(AiActionAuditModel.create).toHaveBeenCalledWith({
      ownerId: 'user-1', lessonId: 'lesson-1', title: 'Intro to hooks',
      previousScheduledAt, newScheduledAt: new Date('2024-06-11T18:00:00.000Z'),
      source: 'COACH', approvedAt: expect.any(Date)
    });
    expect(result).toEqual({ updated: 1 });
  });

  it('defaults the audit source to REPLAN when none is given', async () => {
    vi.mocked(LessonModel.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue({ title: 'Intro', scheduledAt: undefined }) } as never);
    vi.mocked(LessonModel.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);

    await applyReplanProposal('user-1', [{ lessonId: 'lesson-1', proposedScheduledAt: '2024-06-11T18:00:00.000Z' }]);

    expect(AiActionAuditModel.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'REPLAN' }));
  });

  it('skips a change whose lesson no longer belongs to this owner', async () => {
    vi.mocked(LessonModel.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);

    const result = await applyReplanProposal('user-1', [{ lessonId: 'missing', proposedScheduledAt: '2024-06-11T18:00:00.000Z' }]);

    expect(LessonModel.updateOne).not.toHaveBeenCalled();
    expect(AiActionAuditModel.create).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: 0 });
  });

  it('does not write an audit record when the update does not actually modify the lesson', async () => {
    vi.mocked(LessonModel.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue({ title: 'Intro', scheduledAt: undefined }) } as never);
    vi.mocked(LessonModel.updateOne).mockResolvedValue({ modifiedCount: 0 } as never);

    const result = await applyReplanProposal('user-1', [{ lessonId: 'lesson-1', proposedScheduledAt: '2024-06-11T18:00:00.000Z' }]);

    expect(AiActionAuditModel.create).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: 0 });
  });
});

describe('listAiActionAudit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes to the owner, sorts newest first, and clamps the limit', async () => {
    const sort = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const lean = vi.fn().mockResolvedValue([]);
    vi.mocked(AiActionAuditModel.find).mockReturnValue({ sort, limit, lean } as never);

    await listAiActionAudit('user-1', 500);

    expect(AiActionAuditModel.find).toHaveBeenCalledWith({ ownerId: 'user-1' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(100);
  });
});
