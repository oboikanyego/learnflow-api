import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { coach, generatePlan, getPlanJob, listPlanJobs, providerStatus, queuePlan } from '../controllers/ai.controller.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.get('/provider', providerStatus);
aiRouter.post('/generate-plan', generatePlan);
aiRouter.post('/generate-plan/background', queuePlan);
aiRouter.get('/plan-jobs', listPlanJobs);
aiRouter.get('/plan-jobs/:id', getPlanJob);
aiRouter.post('/coach', coach);
