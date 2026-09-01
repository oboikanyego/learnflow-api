import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { analyseJob, getJobAnalysis, listJobAnalyses } from '../controllers/job-intelligence.controller.js';

export const jobIntelligenceRouter = Router();
jobIntelligenceRouter.use(requireAuth);
jobIntelligenceRouter.get('/', listJobAnalyses);
jobIntelligenceRouter.post('/analyse', analyseJob);
jobIntelligenceRouter.get('/:analysisId', getJobAnalysis);
