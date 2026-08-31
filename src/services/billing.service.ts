import { SubscriptionModel, type BillingProvider, type SubscriptionStatus } from '../models/subscription.model.js';
import { getBillingSettings } from './billing-settings.service.js';
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

export async function billingCatalog() {
  const settings = await getBillingSettings();
  return {
    configured: settings.provider !== 'UNCONFIGURED',
    provider: settings.provider,
    currency: settings.currency,
    graceDays: settings.graceDays,
    plans: {
      FREE: { monthlyAmountMinor: 0, yearlyAmountMinor: 0 },
      PRO: { monthlyAmountMinor: settings.proMonthlyPriceMinor, yearlyAmountMinor: settings.proYearlyPriceMinor }
    }
  };
}

export async function getUserSubscription(userId: string) {
  const [subscription, catalog] = await Promise.all([
    SubscriptionModel.findOne({ userId }).lean(),
    billingCatalog()
  ]);
  return { catalog, subscription };
}

export async function createCheckout(userId: string, interval: 'MONTHLY' | 'YEARLY') {
  const settings = await getBillingSettings();
  if (settings.provider === 'UNCONFIGURED') {
    throw Object.assign(new Error('Billing checkout is not configured yet. LearnFlow billing is ready for a payment provider but no provider has been connected.'), { statusCode: 503 });
  }
  throw Object.assign(new Error(`Checkout adapter for ${settings.provider} has not been implemented yet.`), { statusCode: 501, userId, interval });
}

export async function cancelSubscription(userId: string) {
  const [subscription, settings] = await Promise.all([
    SubscriptionModel.findOne({ userId }),
    getBillingSettings()
  ]);
  if (!subscription || !['ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END'].includes(subscription.status)) {
    throw Object.assign(new Error('No active subscription is available to cancel.'), { statusCode: 409 });
  }
  if (settings.provider === 'UNCONFIGURED') throw Object.assign(new Error('Billing provider is not configured.'), { statusCode: 503 });
  throw Object.assign(new Error(`Cancellation adapter for ${settings.provider} has not been implemented yet.`), { statusCode: 501 });
}

export async function processBillingLifecycleEvent(event: BillingLifecycleEvent) {
  const settings = await getBillingSettings();
  const amountMinor = event.amountMinor ?? (event.billingInterval === 'YEARLY' ? settings.proYearlyPriceMinor : settings.proMonthlyPriceMinor);
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
        currency: event.currency ?? settings.currency,
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

  return { subscription, entitlement: entitlementResult, graceDays: settings.graceDays };
}
