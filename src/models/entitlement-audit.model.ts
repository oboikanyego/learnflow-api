import { Schema, model } from 'mongoose';
import type { EntitlementPlan, EntitlementStatus } from './user.model.js';

export interface EntitlementAuditDocument {
  userId: Schema.Types.ObjectId;
  changedBy: Schema.Types.ObjectId;
  previousPlan: EntitlementPlan;
  newPlan: EntitlementPlan;
  previousStatus: EntitlementStatus;
  newStatus: EntitlementStatus;
  source: 'ADMIN' | 'BILLING' | 'SYSTEM';
  reason?: string;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
}

const entitlementAuditSchema = new Schema<EntitlementAuditDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  previousPlan: { type: String, enum: ['FREE', 'PRO'], required: true },
  newPlan: { type: String, enum: ['FREE', 'PRO'], required: true },
  previousStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'GRACE'], required: true },
  newStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'GRACE'], required: true },
  source: { type: String, enum: ['ADMIN', 'BILLING', 'SYSTEM'], required: true },
  reason: { type: String, trim: true, maxlength: 300 },
  startsAt: Date,
  endsAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });

entitlementAuditSchema.index({ userId: 1, createdAt: -1 });

export const EntitlementAuditModel = model<EntitlementAuditDocument>('EntitlementAudit', entitlementAuditSchema);
