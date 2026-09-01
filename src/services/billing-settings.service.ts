import { BillingSettingsAuditModel } from '../models/billing-settings-audit.model.js';
import { BillingSettingsModel } from '../models/billing-settings.model.js';
import type { BillingProvider } from '../models/subscription.model.js';

export const DEFAULT_BILLING_SETTINGS = {
  provider: 'UNCONFIGURED' as BillingProvider,
  currency: 'ZAR',
  proMonthlyPriceMinor: 9900,
  proYearlyPriceMinor: 99000,
  graceDays: 3,
  enabled: false,
  providerPlanCodes: { monthly: undefined as string | undefined, yearly: undefined as string | undefined }
};

type SettingsLike = {
  provider: BillingProvider;
  currency: string;
  proMonthlyPriceMinor: number;
  proYearlyPriceMinor: number;
  graceDays: number;
  enabled?: boolean;
  providerPlanCodes?: { monthly?: string; yearly?: string };
};

function snapshot(settings: SettingsLike) {
  return {
    provider: settings.provider,
    currency: settings.currency,
    proMonthlyPriceMinor: settings.proMonthlyPriceMinor,
    proYearlyPriceMinor: settings.proYearlyPriceMinor,
    graceDays: settings.graceDays,
    enabled: settings.enabled ?? false,
    providerPlanCodes: {
      monthly: settings.providerPlanCodes?.monthly,
      yearly: settings.providerPlanCodes?.yearly
    }
  };
}

export async function getBillingSettings() {
  const settings = await BillingSettingsModel.findOneAndUpdate({ key: 'DEFAULT' }, { $setOnInsert: { key: 'DEFAULT', ...DEFAULT_BILLING_SETTINGS } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  if (!settings) throw Object.assign(new Error('Unable to load billing settings.'), { statusCode: 500 });
  return { ...snapshot(settings), updatedAt: settings.updatedAt };
}

export async function updateBillingSettings(input: SettingsLike & { enabled: boolean; updatedBy: string }) {
  if (input.proMonthlyPriceMinor < 0 || input.proYearlyPriceMinor < 0) throw Object.assign(new Error('Billing prices cannot be negative.'), { statusCode: 400 });
  if (input.proYearlyPriceMinor < input.proMonthlyPriceMinor) throw Object.assign(new Error('Yearly Pro pricing cannot be lower than one month of Pro.'), { statusCode: 400 });
  if (input.enabled && input.provider === 'UNCONFIGURED') throw Object.assign(new Error('Billing cannot be enabled without selecting a provider.'), { statusCode: 400 });
  if (input.enabled && input.provider === 'PAYSTACK' && (!input.providerPlanCodes?.monthly || !input.providerPlanCodes?.yearly)) {
    throw Object.assign(new Error('Paystack billing requires both monthly and yearly plan codes before it can be enabled.'), { statusCode: 400 });
  }

  const previousDoc = await BillingSettingsModel.findOneAndUpdate({ key: 'DEFAULT' }, { $setOnInsert: { key: 'DEFAULT', ...DEFAULT_BILLING_SETTINGS } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  if (!previousDoc) throw Object.assign(new Error('Unable to initialize billing settings.'), { statusCode: 500 });

  const settings = await BillingSettingsModel.findOneAndUpdate(
    { key: 'DEFAULT' },
    { $set: {
      provider: input.provider,
      currency: input.currency.toUpperCase(),
      proMonthlyPriceMinor: input.proMonthlyPriceMinor,
      proYearlyPriceMinor: input.proYearlyPriceMinor,
      graceDays: input.graceDays,
      enabled: input.enabled,
      providerPlanCodes: {
        monthly: input.providerPlanCodes?.monthly?.trim() || undefined,
        yearly: input.providerPlanCodes?.yearly?.trim() || undefined
      },
      updatedBy: input.updatedBy
    } },
    { new: true }
  ).lean();
  if (!settings) throw Object.assign(new Error('Unable to update billing settings.'), { statusCode: 500 });

  await BillingSettingsAuditModel.create({ changedBy: input.updatedBy, previous: snapshot(previousDoc), next: snapshot(settings) });
  return settings;
}

export async function listBillingSettingsAudit() {
  return BillingSettingsAuditModel.find().sort({ createdAt: -1 }).limit(100).populate('changedBy', 'name email').lean();
}
