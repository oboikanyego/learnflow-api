import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getHierarchy,
  getLesson,
  createPhase,
  createModule,
  createLesson,
  patchLesson,
  deletePhase,
  deleteModule,
  deleteLesson
} from '../controllers/hierarchy.controller.js';
import { addLessonComment, listLessonComments } from '../controllers/lesson-comment.controller.js';

export const hierarchyRouter = Router();

hierarchyRouter.get('/learning-paths/:learningPathId/hierarchy', requireAuth, getHierarchy);
hierarchyRouter.get('/lessons/:lessonId', requireAuth, getLesson);
hierarchyRouter.post('/learning-paths/:learningPathId/phases', requireAuth, createPhase);
hierarchyRouter.post('/phases/:phaseId/modules', requireAuth, createModule);
hierarchyRouter.post('/modules/:moduleId/lessons', requireAuth, createLesson);
hierarchyRouter.patch('/lessons/:lessonId', requireAuth, patchLesson);
hierarchyRouter.get('/lessons/:lessonId/comments', requireAuth, listLessonComments);
hierarchyRouter.post('/lessons/:lessonId/comments', requireAuth, addLessonComment);
hierarchyRouter.delete('/phases/:phaseId', requireAuth, deletePhase);
hierarchyRouter.delete('/modules/:moduleId', requireAuth, deleteModule);
hierarchyRouter.delete('/lessons/:lessonId', requireAuth, deleteLesson);
