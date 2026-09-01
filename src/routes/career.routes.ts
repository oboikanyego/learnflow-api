import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { addSkillEvidence, deleteSkillEvidence, getCareerOverview, listCareerLessons, upsertCareerTarget } from '../controllers/career.controller.js';

export const careerRouter = Router();
careerRouter.use(requireAuth);
careerRouter.get('/overview', getCareerOverview);
careerRouter.get('/lessons', listCareerLessons);
careerRouter.put('/target', upsertCareerTarget);
careerRouter.post('/evidence', addSkillEvidence);
careerRouter.delete('/evidence/:evidenceId', deleteSkillEvidence);
