import { env } from '../config/env.js';
import { SubscriptionModel, type BillingProvider, type SubscriptionStatus } from '../models/subscription.model.js';
import { applyEntitlementChange } from './entitlement.service.js';

export interface BillingLifecycleEvent {
  provider: Exclude<BillingProvider, 'UNCONFIGURED'>;
  eventId: string;
  userId: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPlanId?: string;
  status: SubscriptionStatus;
  amountMinor?: number;
  currency?: string;
  billingInterval?: 'MONTHLY' | 'YEARLY';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  lastPaymentAt?: Date;
  nextBillingAt?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
}

function entitlementForStatus(status: SubscriptionStatus) {
  if (status === 'ACTIVE' || status === 'CANCEL_AT_PERIOD_END') return { plan: 'PRO' as const, status: 'ACTIVE' as const };
  if (status === 'PAST_DUE') return { plan: 'PRO' as const, status: 'GRACE' as const };
  return { plan: 'FREE' as const, status: 'ACTIVE' as const };
}

export function billingCatalog() {
  return {
    configured: env.BILLING_PROVIDER !== 'UNCONFIGURED',
    provider: env.BILLING_PROVIDER,
    currency: 'ZAR',
    graceDays: env.BILLING_GRACE_DAYS,
    plans: {
      FREE: { monthlyAmountMinor: 0, yearlyAmountMinor: 0 },
      PRO: { monthlyAmountMinor: env.PRO_MONTHLY_PRICE_ZAR_CENTS, yearlyAmountMinor: env.PRO_YEARLY_PRICE_ZAR_CENTS }
    }
  };
}

export async function getUserSubscription(userId: string) {
  const subscription = await SubscriptionModel.findOne({ userId }).lean();
  return { catalog: billingCatalog(), subscription };
}

export async function createCheckout(userId: string, interval: 'MONTHLY' | 'YEARLY') {
  if (env.BILLING_PROVIDER === 'UNCONFIGURED') {
    throw Object.assign(new Error('Billing checkout is not configured yet. LearnFlow billing is ready for a payment provider but no provider has been connected.'), { statusCode: 503 });
  }
  throw Object.assign(new Error(`Checkout adapter for ${env.BILLING_PROVIDER} has not been implemented yet.`), { statusCode: 501, userId, interval });
}

export async function cancelSubscription(userId: string) {
  const subscription = await SubscriptionModel.findOne({ userId });
  if (!subscription || !['ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END'].includes(subscription.status)) {
    throw Object.assign(new Error('No active subscription is available to cancel.'), { statusCode: 409 });
  }
  if (env.BILLING_PROVIDER === 'UNCONFIGURED') throw Object.assign(new Error('Billing provider is not configured.'), { statusCode: 503 });
  throw Object.assign(new Error(`Cancellation adapter for ${env.BILLING_PROVIDER} has not been implemented yet.`), { statusCode: 501 });
}

export async function processBillingLifecycleEvent(event: BillingLifecycleEvent) {
  const amountMinor = event.amountMinor ?? (event.billingInterval === 'YEARLY' ? env.PRO_YEARLY_PRICE_ZAR_CENTS : env.PRO_MONTHLY_PRICE_ZAR_CENTS);
  const subscription = await SubscriptionModel.findOneAndUpdate(
    { userId: event.userId },
    {
      $set: {
        provider: event.provider,
        providerCustomerId: event.providerCustomerId,
        providerSubscriptionId: event.providerSubscriptionId,
        providerPlanId: event.providerPlanId,
        plan: 'PRO',
        status: event.status,
        currency: event.currency ?? 'ZAR',
        amountMinor,
        billingInterval: event.billingInterval ?? 'MONTHLY',
        currentPeriodStart: event.currentPeriodStart,
        currentPeriodEnd: event.currentPeriodEnd,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? event.status === 'CANCEL_AT_PERIOD_END',
        cancelledAt: ['CANCELLED', 'EXPIRED'].includes(event.status) ? new Date() : undefined,
        lastPaymentAt: event.lastPaymentAt,
        nextBillingAt: event.nextBillingAt,
        metadata: event.metadata
      },
      $setOnInsert: { userId: event.userId }
    },
    { upsert: true, new: true }
  );

  const entitlement = entitlementForStatus(event.status);
  const entitlementResult = await applyEntitlementChange({
    userId: event.userId,
    plan: entitlement.plan,
    status: entitlement.status,
    source: 'BILLING',
    provider: event.provider,
    providerEventId: event.eventId,
    reason: `Billing lifecycle event: ${event.status}`,
    startsAt: event.currentPeriodStart ?? new Date(),
    endsAt: entitlement.plan === 'PRO' ? event.currentPeriodEnd : undefined
  });

  return { subscription, entitlement: entitlementResult };
}
