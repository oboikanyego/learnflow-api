import { LearningPathModel } from '../models/learning-path.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';

export async function cleanupOrphanedLearningData(): Promise<{ phases: number; modules: number; lessons: number }> {
  const validPathIds = await LearningPathModel.distinct('_id');
  const [phases, modules, lessons] = await Promise.all([
    PhaseModel.deleteMany({ learningPathId: { $nin: validPathIds } }),
    ModuleModel.deleteMany({ learningPathId: { $nin: validPathIds } }),
    LessonModel.deleteMany({ learningPathId: { $nin: validPathIds } })
  ]);
  return { phases: phases.deletedCount ?? 0, modules: modules.deletedCount ?? 0, lessons: lessons.deletedCount ?? 0 };
}
