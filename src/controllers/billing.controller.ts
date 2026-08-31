import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { billingCatalog, cancelSubscription, createCheckout, getUserSubscription } from '../services/billing.service.js';

const checkoutSchema = z.object({ interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY') });

export async function getCatalog(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await billingCatalog()); } catch (error) { next(error); }
}

export async function getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getUserSubscription(req.user!.id)); } catch (error) { next(error); }
}

export async function checkout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { interval } = checkoutSchema.parse(req.body);
    res.status(201).json(await createCheckout(req.user!.id, interval));
  } catch (error) { next(error); }
}

export async function cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await cancelSubscription(req.user!.id)); } catch (error) { next(error); }
}
