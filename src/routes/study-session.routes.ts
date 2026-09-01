import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { abandonStudySession, completeStudySession, getActiveStudySession, listStudySessions, pauseStudySession, resumeStudySession, startStudySession } from '../controllers/study-session.controller.js';

export const studySessionRouter = Router();
studySessionRouter.use(requireAuth);
studySessionRouter.get('/', listStudySessions);
studySessionRouter.get('/lesson/:lessonId/active', getActiveStudySession);
studySessionRouter.post('/lesson/:lessonId/start', startStudySession);
studySessionRouter.post('/:sessionId/pause', pauseStudySession);
studySessionRouter.post('/:sessionId/resume', resumeStudySession);
studySessionRouter.post('/:sessionId/complete', completeStudySession);
studySessionRouter.post('/:sessionId/abandon', abandonStudySession);
