import { Schema, model, Types } from 'mongoose';

export type AiActionAuditSource = 'REPLAN' | 'COACH';

export interface AiActionAuditDocument {
  ownerId: Types.ObjectId;
  lessonId: Types.ObjectId;
  title: string;
  previousScheduledAt?: Date;
  newScheduledAt: Date;
  source: AiActionAuditSource;
  approvedAt: Date;
  createdAt: Date;
}

const schema = new Schema<AiActionAuditDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, required: true, ref: 'Lesson' },
  title: { type: String, required: true },
  previousScheduledAt: Date,
  newScheduledAt: { type: Date, required: true },
  source: { type: String, enum: ['REPLAN', 'COACH'], required: true },
  approvedAt: { type: Date, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ ownerId: 1, createdAt: -1 });

export const AiActionAuditModel = model<AiActionAuditDocument>('AiActionAudit', schema);
