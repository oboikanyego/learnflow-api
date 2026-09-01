import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { addSkillEvidence, deleteSkillEvidence, getCareerOverview, upsertCareerTarget } from '../controllers/career.controller.js';

export const careerRouter = Router();
careerRouter.use(requireAuth);
careerRouter.get('/overview', getCareerOverview);
careerRouter.put('/target', upsertCareerTarget);
careerRouter.post('/evidence', addSkillEvidence);
careerRouter.delete('/evidence/:evidenceId', deleteSkillEvidence);
