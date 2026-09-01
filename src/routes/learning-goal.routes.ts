import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createGoal, deleteGoal, listGoals, updateGoal } from '../controllers/learning-goal.controller.js';

export const learningGoalRouter = Router();
learningGoalRouter.use(requireAuth);
learningGoalRouter.get('/', listGoals);
learningGoalRouter.post('/', createGoal);
learningGoalRouter.patch('/:id', updateGoal);
learningGoalRouter.delete('/:id', deleteGoal);
