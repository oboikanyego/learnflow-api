import { Schema, model, type Types } from 'mongoose';

export interface WeeklyReviewDeliveryDocument {
  ownerId: Types.ObjectId;
  weekStart: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  provider?: string;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<WeeklyReviewDeliveryDocument>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekStart: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
  provider: String,
  providerMessageId: String,
  errorMessage: String,
  sentAt: Date
}, { timestamps: true });

schema.index({ ownerId: 1, weekStart: 1 }, { unique: true });
export const WeeklyReviewDeliveryModel = model<WeeklyReviewDeliveryDocument>('WeeklyReviewDelivery', schema);
