import { Schema, model } from 'mongoose';

export type UserManagementAction = 'ACCOUNT_DELETED';

const userManagementAuditSchema = new Schema({
  targetUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, enum: ['ACCOUNT_DELETED'], required: true, index: true },
  performedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  inactivityDays: { type: Number, required: true, min: 0 },
  cleanupThresholdDays: { type: Number, required: true, min: 1 },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

userManagementAuditSchema.set('strict', true);

export const UserManagementAuditModel = model('UserManagementAudit', userManagementAuditSchema);
