import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/phase.model.js', () => ({ PhaseModel: { deleteMany: vi.fn() } }));
vi.mock('../models/module.model.js', () => ({ ModuleModel: { deleteMany: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({ LessonModel: { deleteMany: vi.fn(), distinct: vi.fn() } }));
vi.mock('../models/study-session.model.js', () => ({ StudySessionModel: { deleteMany: vi.fn() } }));
vi.mock('../models/lesson-comment.model.js', () => ({ LessonCommentModel: { deleteMany: vi.fn() } }));
vi.mock('./learning-email.service.js', () => ({ sendPlanCreatedEmail: vi.fn() }));

import { LearningPathService } from './learning-path.service.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { StudySessionModel } from '../models/study-session.model.js';
import { LessonCommentModel } from '../models/lesson-comment.model.js';

function fakeRepository(removeResult: unknown) {
  return { remove: vi.fn().mockResolvedValue(removeResult), findAll: vi.fn(), create: vi.fn(), findById: vi.fn(), update: vi.fn() };
}

describe('LearningPathService.remove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cascades to delete phases, modules, lessons, study sessions and comments under the removed path', async () => {
    const repository = fakeRepository({ _id: 'path-1' });
    const service = new LearningPathService(repository as never);
    vi.mocked(LessonModel.distinct).mockResolvedValue(['lesson-1', 'lesson-2'] as never);
    vi.mocked(PhaseModel.deleteMany).mockResolvedValue({ deletedCount: 1 } as never);
    vi.mocked(ModuleModel.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);
    vi.mocked(LessonModel.deleteMany).mockResolvedValue({ deletedCount: 5 } as never);
    vi.mocked(StudySessionModel.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);
    vi.mocked(LessonCommentModel.deleteMany).mockResolvedValue({ deletedCount: 4 } as never);

    await service.remove('user-1', 'path-1');

    expect(repository.remove).toHaveBeenCalledWith('user-1', 'path-1');
    expect(LessonModel.distinct).toHaveBeenCalledWith('_id', { ownerId: 'user-1', learningPathId: 'path-1' });
    expect(PhaseModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
    expect(ModuleModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
    expect(LessonModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
    expect(StudySessionModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: ['lesson-1', 'lesson-2'] } });
    expect(LessonCommentModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', lessonId: { $in: ['lesson-1', 'lesson-2'] } });
  });

  it('throws 404 and does not cascade when the path does not belong to this owner', async () => {
    const repository = fakeRepository(null);
    const service = new LearningPathService(repository as never);

    await expect(service.remove('user-1', 'missing-path')).rejects.toMatchObject({ statusCode: 404 });

    expect(LessonModel.distinct).not.toHaveBeenCalled();
    expect(PhaseModel.deleteMany).not.toHaveBeenCalled();
    expect(ModuleModel.deleteMany).not.toHaveBeenCalled();
    expect(LessonModel.deleteMany).not.toHaveBeenCalled();
    expect(StudySessionModel.deleteMany).not.toHaveBeenCalled();
    expect(LessonCommentModel.deleteMany).not.toHaveBeenCalled();
  });
});
