import { Router } from 'express';
import { cancel, checkout, getCatalog, getSubscription } from '../controllers/billing.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.get('/catalog', getCatalog);
billingRouter.get('/subscription', getSubscription);
billingRouter.post('/checkout', checkout);
billingRouter.post('/cancel', cancel);
