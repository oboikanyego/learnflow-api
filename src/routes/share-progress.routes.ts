import { Router } from 'express';
import { enableProgressShare, getPublicProgress, revokeProgressShare } from '../controllers/share-progress.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const shareProgressRouter=Router();
shareProgressRouter.use(requireAuth);
shareProgressRouter.post('/:learningPathId',enableProgressShare);
shareProgressRouter.delete('/:learningPathId',revokeProgressShare);

export const publicProgressRouter=Router();
publicProgressRouter.get('/:token',getPublicProgress);
