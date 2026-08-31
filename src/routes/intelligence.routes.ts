import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { applyReplan, getIntelligenceOverview, getLearningCalendar, progressCoach, proposeReplan } from '../controllers/intelligence.controller.js';

export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth);
intelligenceRouter.get('/overview', getIntelligenceOverview);
intelligenceRouter.get('/calendar', getLearningCalendar);
intelligenceRouter.post('/coach', progressCoach);
intelligenceRouter.get('/replan', proposeReplan);
intelligenceRouter.post('/replan/apply', applyReplan);
