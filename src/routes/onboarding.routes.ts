import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { completeOnboarding, getOnboarding } from '../controllers/onboarding.controller.js';

export const onboardingRouter = Router();
onboardingRouter.use(requireAuth);
onboardingRouter.get('/', getOnboarding);
onboardingRouter.put('/', completeOnboarding);
