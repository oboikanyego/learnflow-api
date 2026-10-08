import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/learning-path.model.js', () => ({ LearningPathModel: { distinct: vi.fn() } }));
vi.mock('../models/phase.model.js', () => ({ PhaseModel: { deleteMany: vi.fn() } }));
vi.mock('../models/module.model.js', () => ({ ModuleModel: { deleteMany: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({ LessonModel: { deleteMany: vi.fn() } }));

import { cleanupOrphanedLearningData } from './data-integrity.service.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';

describe('cleanupOrphanedLearningData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes phases, modules and lessons whose learningPathId no longer exists', async () => {
    vi.mocked(LearningPathModel.distinct).mockResolvedValue(['path-1', 'path-2'] as never);
    vi.mocked(PhaseModel.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);
    vi.mocked(ModuleModel.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);
    vi.mocked(LessonModel.deleteMany).mockResolvedValue({ deletedCount: 7 } as never);

    const result = await cleanupOrphanedLearningData();

    expect(LearningPathModel.distinct).toHaveBeenCalledWith('_id');
    expect(PhaseModel.deleteMany).toHaveBeenCalledWith({ learningPathId: { $nin: ['path-1', 'path-2'] } });
    expect(ModuleModel.deleteMany).toHaveBeenCalledWith({ learningPathId: { $nin: ['path-1', 'path-2'] } });
    expect(LessonModel.deleteMany).toHaveBeenCalledWith({ learningPathId: { $nin: ['path-1', 'path-2'] } });
    expect(result).toEqual({ phases: 2, modules: 3, lessons: 7 });
  });

  it('reports zero when nothing is orphaned', async () => {
    vi.mocked(LearningPathModel.distinct).mockResolvedValue([] as never);
    vi.mocked(PhaseModel.deleteMany).mockResolvedValue({ deletedCount: 0 } as never);
    vi.mocked(ModuleModel.deleteMany).mockResolvedValue({ deletedCount: 0 } as never);
    vi.mocked(LessonModel.deleteMany).mockResolvedValue({ deletedCount: 0 } as never);

    const result = await cleanupOrphanedLearningData();

    expect(result).toEqual({ phases: 0, modules: 0, lessons: 0 });
  });
});
