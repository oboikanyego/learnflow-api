import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { completeReview, getRetentionSummary, listReviewQueue } from '../controllers/retention.controller.js';

export const retentionRouter = Router();
retentionRouter.use(requireAuth);
retentionRouter.get('/', getRetentionSummary);
retentionRouter.get('/queue', listReviewQueue);
retentionRouter.post('/lessons/:lessonId/review', completeReview);
