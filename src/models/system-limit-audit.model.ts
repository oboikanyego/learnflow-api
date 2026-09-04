import { Schema, model } from 'mongoose';

export interface SystemLimitAuditDocument {
  key: string;
  category: string;
  oldValue: number;
  newValue: number;
  changedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const systemLimitAuditSchema = new Schema<SystemLimitAuditDocument>({
  key: { type: String, required: true, uppercase: true, trim: true, index: true },
  category: { type: String, required: true, trim: true },
  oldValue: { type: Number, required: true },
  newValue: { type: Number, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now, immutable: true, index: true }
}, { versionKey: false });

systemLimitAuditSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function(next) {
  next(new Error('System limit audit history is immutable'));
});

export const SystemLimitAuditModel = model<SystemLimitAuditDocument>('SystemLimitAudit', systemLimitAuditSchema);
