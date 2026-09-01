import { Schema, model } from 'mongoose';
import type { BillingProvider } from './subscription.model.js';

export interface BillingSettingsSnapshot {
  provider: BillingProvider;
  currency: string;
  proMonthlyPriceMinor: number;
  proYearlyPriceMinor: number;
  graceDays: number;
  enabled: boolean;
  providerPlanCodes?: { monthly?: string; yearly?: string };
}

export interface BillingSettingsAuditDocument {
  changedBy: Schema.Types.ObjectId;
  previous: BillingSettingsSnapshot;
  next: BillingSettingsSnapshot;
  createdAt: Date;
}

const snapshotSchema = new Schema<BillingSettingsSnapshot>({
  provider: { type: String, enum: ['UNCONFIGURED', 'PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE'], required: true },
  currency: { type: String, required: true },
  proMonthlyPriceMinor: { type: Number, required: true },
  proYearlyPriceMinor: { type: Number, required: true },
  graceDays: { type: Number, required: true },
  enabled: { type: Boolean, required: true },
  providerPlanCodes: {
    monthly: { type: String },
    yearly: { type: String }
  }
}, { _id: false });

const auditSchema = new Schema<BillingSettingsAuditDocument>({
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  previous: { type: snapshotSchema, required: true },
  next: { type: snapshotSchema, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditSchema.index({ createdAt: -1 });

export const BillingSettingsAuditModel = model<BillingSettingsAuditDocument>('BillingSettingsAudit', auditSchema);
