import { Schema, model } from 'mongoose';
import type { BillingProvider } from './subscription.model.js';

export type BillingEventStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export interface BillingEventDocument {
  provider: Exclude<BillingProvider, 'UNCONFIGURED'>;
  providerEventId: string;
  eventType: string;
  userId?: Schema.Types.ObjectId;
  status: BillingEventStatus;
  payloadHash: string;
  attempts: number;
  error?: string;
  metadata?: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const billingEventSchema = new Schema<BillingEventDocument>({
  provider: {
    type: String,
    enum: ['PAYSTACK', 'PEACH', 'YOCO', 'OZOW', 'STRIPE'],
    required: true,
    index: true
  },
  providerEventId: { type: String, required: true, trim: true },
  eventType: { type: String, required: true, trim: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  status: {
    type: String,
    enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'],
    required: true,
    default: 'RECEIVED',
    index: true
  },
  payloadHash: { type: String, required: true, trim: true },
  attempts: { type: Number, required: true, default: 1, min: 1 },
  error: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  receivedAt: { type: Date, required: true, default: Date.now, index: true },
  processedAt: Date
}, { timestamps: true });

billingEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
billingEventSchema.index({ status: 1, receivedAt: -1 });

export const BillingEventModel = model<BillingEventDocument>('BillingEvent', billingEventSchema);
