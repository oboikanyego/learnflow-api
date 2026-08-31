import { Schema, model } from 'mongoose';
import type { BillingProvider } from './subscription.model.js';

export interface BillingSettingsDocument {
  key: 'DEFAULT';
  provider: BillingProvider;
  currency: string;
  proMonthlyPriceMinor: number;
  proYearlyPriceMinor: number;
  graceDays: number;
  enabled: boolean;
  updatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const billingSettingsSchema = new Schema<BillingSettingsDocument>({
  key: { type: String, enum: ['DEFAULT'], default: 'DEFAULT', unique: true, required: true },
  provider: { type: String, enum: ['UNCONFIGURED', 'PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE'], default: 'UNCONFIGURED', required: true },
  currency: { type: String, default: 'ZAR', uppercase: true, trim: true, required: true },
  proMonthlyPriceMinor: { type: Number, default: 9900, min: 0, required: true },
  proYearlyPriceMinor: { type: Number, default: 99000, min: 0, required: true },
  graceDays: { type: Number, default: 3, min: 0, max: 30, required: true },
  enabled: { type: Boolean, default: false, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const BillingSettingsModel = model<BillingSettingsDocument>('BillingSettings', billingSettingsSchema);
