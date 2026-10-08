import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/phase.model.js', () => ({ PhaseModel: { deleteMany: vi.fn() } }));
vi.mock('../models/module.model.js', () => ({ ModuleModel: { deleteMany: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({ LessonModel: { deleteMany: vi.fn() } }));
vi.mock('./learning-email.service.js', () => ({ sendPlanCreatedEmail: vi.fn() }));

import { LearningPathService } from './learning-path.service.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';

function fakeRepository(removeResult: unknown) {
  return { remove: vi.fn().mockResolvedValue(removeResult), findAll: vi.fn(), create: vi.fn(), findById: vi.fn(), update: vi.fn() };
}

describe('LearningPathService.remove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cascades to delete phases, modules and lessons under the removed path', async () => {
    const repository = fakeRepository({ _id: 'path-1' });
    const service = new LearningPathService(repository as never);
    vi.mocked(PhaseModel.deleteMany).mockResolvedValue({ deletedCount: 1 } as never);
    vi.mocked(ModuleModel.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);
    vi.mocked(LessonModel.deleteMany).mockResolvedValue({ deletedCount: 5 } as never);

    await service.remove('user-1', 'path-1');

    expect(repository.remove).toHaveBeenCalledWith('user-1', 'path-1');
    expect(PhaseModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
    expect(ModuleModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
    expect(LessonModel.deleteMany).toHaveBeenCalledWith({ ownerId: 'user-1', learningPathId: 'path-1' });
  });

  it('throws 404 and does not cascade when the path does not belong to this owner', async () => {
    const repository = fakeRepository(null);
    const service = new LearningPathService(repository as never);

    await expect(service.remove('user-1', 'missing-path')).rejects.toMatchObject({ statusCode: 404 });

    expect(PhaseModel.deleteMany).not.toHaveBeenCalled();
    expect(ModuleModel.deleteMany).not.toHaveBeenCalled();
    expect(LessonModel.deleteMany).not.toHaveBeenCalled();
  });
});
