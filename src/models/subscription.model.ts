import { Schema, model } from 'mongoose';

export type BillingProvider = 'UNCONFIGURED' | 'PAYSTACK' | 'PEACH' | 'YOCO' | 'OZOW' | 'STRIPE';
export type SubscriptionStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCEL_AT_PERIOD_END' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionDocument {
  userId: Schema.Types.ObjectId;
  provider: BillingProvider;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPlanId?: string;
  providerCancellationToken?: string;
  plan: 'PRO';
  status: SubscriptionStatus;
  currency: string;
  amountMinor: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  lastPaymentAt?: Date;
  nextBillingAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  provider: { type: String, enum: ['UNCONFIGURED', 'PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE'], required: true, default: 'UNCONFIGURED' },
  providerCustomerId: { type: String, trim: true },
  providerSubscriptionId: { type: String, trim: true, index: true },
  providerPlanId: { type: String, trim: true },
  providerCancellationToken: { type: String, trim: true, select: false },
  plan: { type: String, enum: ['PRO'], required: true, default: 'PRO' },
  status: { type: String, enum: ['NONE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END', 'CANCELLED', 'EXPIRED'], required: true, default: 'NONE', index: true },
  currency: { type: String, required: true, default: 'ZAR', uppercase: true },
  amountMinor: { type: Number, required: true, min: 0 },
  billingInterval: { type: String, enum: ['MONTHLY', 'YEARLY'], required: true, default: 'MONTHLY' },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  lastPaymentAt: Date,
  nextBillingAt: Date,
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

subscriptionSchema.index({ provider: 1, providerSubscriptionId: 1 }, { sparse: true });

export const SubscriptionModel = model<SubscriptionDocument>('Subscription', subscriptionSchema);
