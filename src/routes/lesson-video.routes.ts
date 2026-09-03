import { Router } from 'express';
import { listVideoLessons, searchLessonVideos } from '../controllers/lesson-video.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const lessonVideoRouter = Router();
lessonVideoRouter.use(requireAuth);
lessonVideoRouter.get('/lessons', listVideoLessons);
lessonVideoRouter.post('/search', searchLessonVideos);
