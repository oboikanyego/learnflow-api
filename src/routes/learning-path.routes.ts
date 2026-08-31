import { Router } from 'express';
import { createLearningPath, listLearningPaths } from '../controllers/learning-path.controller.js';
export const learningPathRouter = Router();
learningPathRouter.get('/', listLearningPaths);
learningPathRouter.post('/', createLearningPath);
