import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { coach, generatePlan, getPlanJob, listPlanJobs, providerStatus, queuePlan, retryPlanJob, usageStatus } from '../controllers/ai.controller.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.get('/provider', providerStatus);
aiRouter.get('/usage', usageStatus);
aiRouter.post('/generate-plan', generatePlan);
aiRouter.post('/generate-plan/background', queuePlan);
aiRouter.get('/plan-jobs', listPlanJobs);
aiRouter.get('/plan-jobs/:id', getPlanJob);
aiRouter.post('/plan-jobs/:id/retry', retryPlanJob);
aiRouter.post('/coach', coach);
