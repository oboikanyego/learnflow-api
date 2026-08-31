import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SubscriptionModel } from '../models/subscription.model.js';
import { UserModel } from '../models/user.model.js';
import { billingCatalog, cancelSubscription, createCheckout, getUserSubscription, processBillingLifecycleEvent, type BillingLifecycleEvent } from '../services/billing.service.js';
import { verifyPaystackWebhook } from '../services/paystack.service.js';

const checkoutSchema = z.object({ interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY') });

type PaystackData = Record<string, any>;

function date(value: unknown): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function subscriptionCode(data: PaystackData): string | undefined {
  return data.subscription_code ?? data.subscription?.subscription_code ?? data.subscription?.code;
}

function planCode(data: PaystackData): string | undefined {
  return data.plan?.plan_code ?? data.plan_code ?? data.subscription?.plan?.plan_code;
}

function customerEmail(data: PaystackData): string | undefined {
  return data.customer?.email ?? data.email ?? data.subscription?.customer?.email;
}

function interval(data: PaystackData): 'MONTHLY' | 'YEARLY' | undefined {
  const value = String(data.plan?.interval ?? data.subscription?.plan?.interval ?? '').toLowerCase();
  if (value === 'monthly') return 'MONTHLY';
  if (value === 'annually' || value === 'annual' || value === 'yearly') return 'YEARLY';
  return undefined;
}

async function resolveUserId(data: PaystackData): Promise<string | undefined> {
  const metadataUserId = data.metadata?.learnflowUserId ?? data.metadata?.custom_fields?.find?.((item: any) => item?.variable_name === 'learnflowUserId')?.value;
  if (metadataUserId) return String(metadataUserId);

  const subCode = subscriptionCode(data);
  if (subCode) {
    const existing = await SubscriptionModel.findOne({ provider: 'PAYSTACK', providerSubscriptionId: subCode }).select('userId').lean();
    if (existing?.userId) return String(existing.userId);
  }

  const email = customerEmail(data);
  if (email) {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('_id').lean();
    if (user?._id) return String(user._id);
  }
  return undefined;
}

function lifecycleStatus(eventName: string, data: PaystackData): BillingLifecycleEvent['status'] | undefined {
  if (eventName === 'subscription.create') return 'ACTIVE';
  if (eventName === 'invoice.payment_failed') return 'PAST_DUE';
  if (eventName === 'subscription.not_renew') return 'CANCEL_AT_PERIOD_END';
  if (eventName === 'subscription.disable') return String(data.status).toLowerCase() === 'complete' ? 'EXPIRED' : 'CANCELLED';
  if (eventName === 'invoice.update' && data.paid === true) return 'ACTIVE';
  return undefined;
}

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

export async function paystackWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.header('x-paystack-signature') ?? undefined;
    if (!verifyPaystackWebhook(req.body, signature)) return res.status(401).json({ message: 'Invalid Paystack webhook signature.' });

    const eventName = String(req.body?.event ?? '');
    const data = (req.body?.data ?? {}) as PaystackData;
    const status = lifecycleStatus(eventName, data);
    if (!status) return res.status(200).json({ received: true, ignored: true });

    const userId = await resolveUserId(data);
    if (!userId) return res.status(503).json({ message: 'Valid Paystack event could not yet be mapped to a LearnFlow user. Retry required.' });

    const providerEventId = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    await processBillingLifecycleEvent({
      provider: 'PAYSTACK',
      eventId: providerEventId,
      userId,
      providerCustomerId: data.customer?.customer_code ? String(data.customer.customer_code) : undefined,
      providerSubscriptionId: subscriptionCode(data),
      providerPlanId: planCode(data),
      providerCancellationToken: data.email_token ?? data.subscription?.email_token,
      status,
      amountMinor: typeof data.amount === 'number' ? data.amount : undefined,
      currency: data.currency,
      billingInterval: interval(data),
      currentPeriodStart: date(data.period_start),
      currentPeriodEnd: date(data.period_end),
      lastPaymentAt: date(data.paid_at),
      nextBillingAt: date(data.next_payment_date ?? data.subscription?.next_payment_date),
      cancelAtPeriodEnd: status === 'CANCEL_AT_PERIOD_END',
      metadata: { paystackEvent: eventName, invoiceCode: data.invoice_code, reference: data.reference }
    });

    return res.status(200).json({ received: true });
  } catch (error) { next(error); }
}
