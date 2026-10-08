import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { coach, deletePlanJob, generatePlan, getPlanJob, listPlanJobs, providerStatus, queuePlan, retryPlanJob, savePlanJob, usageStatus } from '../controllers/ai.controller.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.get('/provider', providerStatus);
aiRouter.get('/usage', usageStatus);
aiRouter.post('/generate-plan', generatePlan);
aiRouter.post('/generate-plan/background', queuePlan);
aiRouter.get('/plan-jobs', listPlanJobs);
aiRouter.get('/plan-jobs/:id', getPlanJob);
aiRouter.delete('/plan-jobs/:id', deletePlanJob);
aiRouter.post('/plan-jobs/:id/retry', retryPlanJob);
aiRouter.post('/plan-jobs/:id/save', savePlanJob);
aiRouter.post('/coach', coach);
