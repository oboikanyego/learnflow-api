import { Schema, model } from 'mongoose';
import type { EntitlementPlan, EntitlementStatus } from './user.model.js';

export interface EntitlementAuditDocument {
  userId: Schema.Types.ObjectId;
  changedBy?: Schema.Types.ObjectId;
  actorType: 'ADMIN' | 'BILLING' | 'SYSTEM';
  previousPlan: EntitlementPlan;
  newPlan: EntitlementPlan;
  previousStatus: EntitlementStatus;
  newStatus: EntitlementStatus;
  source: 'ADMIN' | 'BILLING' | 'SYSTEM';
  reason?: string;
  provider?: string;
  providerEventId?: string;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
}

const entitlementAuditSchema = new Schema<EntitlementAuditDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actorType: { type: String, enum: ['ADMIN', 'BILLING', 'SYSTEM'], required: true, default: 'SYSTEM' },
  previousPlan: { type: String, enum: ['FREE', 'PRO'], required: true },
  newPlan: { type: String, enum: ['FREE', 'PRO'], required: true },
  previousStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'GRACE'], required: true },
  newStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'GRACE'], required: true },
  source: { type: String, enum: ['ADMIN', 'BILLING', 'SYSTEM'], required: true },
  reason: { type: String, trim: true, maxlength: 300 },
  provider: { type: String, trim: true, maxlength: 40 },
  providerEventId: { type: String, trim: true, maxlength: 160, index: true },
  startsAt: Date,
  endsAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });

entitlementAuditSchema.index({ userId: 1, createdAt: -1 });
entitlementAuditSchema.index({ provider: 1, providerEventId: 1 }, { sparse: true });

export const EntitlementAuditModel = model<EntitlementAuditDocument>('EntitlementAudit', entitlementAuditSchema);
