import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { coach, generatePlan, providerStatus } from '../controllers/ai.controller.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.get('/provider', providerStatus);
aiRouter.post('/generate-plan', generatePlan);
aiRouter.post('/coach', coach);
