import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getBillingSettings, listBillingSettingsAudit, updateBillingSettings } from '../services/billing-settings.service.js';

const billingSettingsSchema = z.object({
  provider: z.enum(['UNCONFIGURED', 'PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE']),
  currency: z.string().trim().length(3),
  proMonthlyPriceMinor: z.number().int().min(0),
  proYearlyPriceMinor: z.number().int().min(0),
  graceDays: z.number().int().min(0).max(30),
  enabled: z.boolean()
});

export async function getAdminBillingSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getBillingSettings()); } catch (error) { next(error); }
}

export async function patchAdminBillingSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { const input = billingSettingsSchema.parse(req.body); res.json(await updateBillingSettings({ ...input, updatedBy: req.user!.id })); } catch (error) { next(error); }
}

export async function getAdminBillingSettingsAudit(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await listBillingSettingsAudit()); } catch (error) { next(error); }
}
