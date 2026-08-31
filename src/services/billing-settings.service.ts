import { BillingSettingsModel } from '../models/billing-settings.model.js';
import type { BillingProvider } from '../models/subscription.model.js';

export const DEFAULT_BILLING_SETTINGS = {
  provider: 'UNCONFIGURED' as BillingProvider,
  currency: 'ZAR',
  proMonthlyPriceMinor: 9900,
  proYearlyPriceMinor: 99000,
  graceDays: 3
};

export async function getBillingSettings() {
  const settings = await BillingSettingsModel.findOneAndUpdate(
    { key: 'DEFAULT' },
    { $setOnInsert: { key: 'DEFAULT', ...DEFAULT_BILLING_SETTINGS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    provider: settings.provider,
    currency: settings.currency,
    proMonthlyPriceMinor: settings.proMonthlyPriceMinor,
    proYearlyPriceMinor: settings.proYearlyPriceMinor,
    graceDays: settings.graceDays,
    updatedAt: settings.updatedAt
  };
}

export async function updateBillingSettings(input: {
  provider: BillingProvider;
  currency: string;
  proMonthlyPriceMinor: number;
  proYearlyPriceMinor: number;
  graceDays: number;
  updatedBy: string;
}) {
  const settings = await BillingSettingsModel.findOneAndUpdate(
    { key: 'DEFAULT' },
    {
      $set: {
        provider: input.provider,
        currency: input.currency.toUpperCase(),
        proMonthlyPriceMinor: input.proMonthlyPriceMinor,
        proYearlyPriceMinor: input.proYearlyPriceMinor,
        graceDays: input.graceDays,
        updatedBy: input.updatedBy
      },
      $setOnInsert: { key: 'DEFAULT' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return settings;
}
