import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SubscriptionModel } from '../models/subscription.model.js';
import { getBillingSettings, listBillingSettingsAudit, updateBillingSettings } from '../services/billing-settings.service.js';

const billingSettingsSchema = z.object({
  provider: z.enum(['UNCONFIGURED', 'PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE']),
  currency: z.string().trim().length(3),
  proMonthlyPriceMinor: z.number().int().min(0),
  proYearlyPriceMinor: z.number().int().min(0),
  graceDays: z.number().int().min(0).max(30),
  enabled: z.boolean(),
  providerPlanCodes: z.object({
    monthly: z.string().trim().optional(),
    yearly: z.string().trim().optional()
  }).optional()
});

export async function getAdminBillingSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json(await getBillingSettings()); } catch (error) { next(error); } }
export async function patchAdminBillingSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const input = billingSettingsSchema.parse(req.body); res.json(await updateBillingSettings({ ...input, updatedBy: req.user!.id })); } catch (error) { next(error); } }
export async function getAdminBillingSettingsAudit(_req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json(await listBillingSettingsAudit()); } catch (error) { next(error); } }

export async function getAdminSubscriptionOperations(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const [rows, recent] = await Promise.all([
      SubscriptionModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SubscriptionModel.find().sort({ updatedAt: -1 }).limit(50).populate('userId', 'name email').lean()
    ]);
    const counts = Object.fromEntries(rows.map((row: { _id: string; count: number }) => [row._id, row.count]));
    res.json({
      total: rows.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
      active: counts.ACTIVE ?? 0,
      pastDue: counts.PAST_DUE ?? 0,
      cancelAtPeriodEnd: counts.CANCEL_AT_PERIOD_END ?? 0,
      cancelled: counts.CANCELLED ?? 0,
      expired: counts.EXPIRED ?? 0,
      pending: counts.PENDING ?? 0,
      recent
    });
  } catch (error) { next(error); }
}
