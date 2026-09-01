import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createCareerOffer, createCareerOutcome, deleteCareerOffer, getCareerOutcomeOverview, updateCareerOffer } from '../controllers/career-outcome.controller.js';

export const careerOutcomeRouter = Router();
careerOutcomeRouter.use(requireAuth);
careerOutcomeRouter.get('/', getCareerOutcomeOverview);
careerOutcomeRouter.post('/offers', createCareerOffer);
careerOutcomeRouter.patch('/offers/:offerId', updateCareerOffer);
careerOutcomeRouter.delete('/offers/:offerId', deleteCareerOffer);
careerOutcomeRouter.post('/feedback', createCareerOutcome);
