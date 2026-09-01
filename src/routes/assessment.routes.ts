import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { generateLessonAssessment, getLatestLessonAssessment, getMasterySummary, submitAssessment } from '../controllers/assessment.controller.js';

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);
assessmentRouter.get('/mastery', getMasterySummary);
assessmentRouter.get('/lessons/:lessonId/latest', getLatestLessonAssessment);
assessmentRouter.post('/lessons/:lessonId/generate', generateLessonAssessment);
assessmentRouter.post('/:assessmentId/submit', submitAssessment);
