import { LearningPathModel } from '../models/learning-path.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { StudySessionModel } from '../models/study-session.model.js';
import { LessonCommentModel } from '../models/lesson-comment.model.js';

export interface OrphanedDataCleanupResult {
  phases: number;
  modules: number;
  lessons: number;
  studySessions: number;
  lessonComments: number;
}

export async function cleanupOrphanedLearningData(): Promise<OrphanedDataCleanupResult> {
  const validPathIds = await LearningPathModel.distinct('_id');
  const [phases, modules, lessons] = await Promise.all([
    PhaseModel.deleteMany({ learningPathId: { $nin: validPathIds } }),
    ModuleModel.deleteMany({ learningPathId: { $nin: validPathIds } }),
    LessonModel.deleteMany({ learningPathId: { $nin: validPathIds } })
  ]);

  const validLessonIds = await LessonModel.distinct('_id');
  const [studySessions, lessonComments] = await Promise.all([
    StudySessionModel.deleteMany({ lessonId: { $nin: validLessonIds } }),
    LessonCommentModel.deleteMany({ lessonId: { $nin: validLessonIds } })
  ]);

  return {
    phases: phases.deletedCount ?? 0,
    modules: modules.deletedCount ?? 0,
    lessons: lessons.deletedCount ?? 0,
    studySessions: studySessions.deletedCount ?? 0,
    lessonComments: lessonComments.deletedCount ?? 0
  };
}
