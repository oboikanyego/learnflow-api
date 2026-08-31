import { Router } from 'express';
import { createLearningPath, deleteLearningPath, getLearningPath, listLearningPaths, updateLearningPath } from '../controllers/learning-path.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const learningPathRouter = Router();
learningPathRouter.use(requireAuth);
learningPathRouter.get('/', listLearningPaths);
learningPathRouter.get('/:id', getLearningPath);
learningPathRouter.post('/', createLearningPath);
learningPathRouter.patch('/:id', updateLearningPath);
learningPathRouter.delete('/:id', deleteLearningPath);
