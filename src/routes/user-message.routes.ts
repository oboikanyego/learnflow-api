import { Router } from 'express';
import { submitContact, submitFeedback, submitSupport } from '../controllers/user-message.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const userMessageRouter = Router();

userMessageRouter.post('/contact', submitContact);
userMessageRouter.post('/feedback', requireAuth, submitFeedback);
userMessageRouter.post('/support', requireAuth, submitSupport);
