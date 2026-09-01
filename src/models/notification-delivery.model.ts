import { Schema, model, Types } from 'mongoose';

export const deliveryChannels = ['IN_APP', 'EMAIL'] as const;
export const deliveryStatuses = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type DeliveryChannel = typeof deliveryChannels[number];
export type DeliveryStatus = typeof deliveryStatuses[number];

export interface NotificationDeliveryDocument {
  ownerId: Types.ObjectId;
  lessonId?: Types.ObjectId;
  eventKey: string;
  eventType: 'REMINDER' | 'MISSED';
  channel: DeliveryChannel;
  status: DeliveryStatus;
  recipient?: string;
  provider?: string;
  providerMessageId?: string;
  attemptCount: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<NotificationDeliveryDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', index: true },
  eventKey: { type: String, required: true, trim: true, maxlength: 220 },
  eventType: { type: String, enum: ['REMINDER', 'MISSED'], required: true, index: true },
  channel: { type: String, enum: deliveryChannels, required: true, index: true },
  status: { type: String, enum: deliveryStatuses, required: true, default: 'PENDING', index: true },
  recipient: { type: String, trim: true },
  provider: { type: String, trim: true },
  providerMessageId: { type: String, trim: true },
  attemptCount: { type: Number, min: 0, default: 0 },
  lastAttemptAt: Date,
  nextAttemptAt: { type: Date, index: true },
  sentAt: Date,
  errorMessage: { type: String, maxlength: 1200 }
}, { timestamps: true });

schema.index({ eventKey: 1, channel: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1 });
schema.index({ createdAt: -1 });

export const NotificationDeliveryModel = model<NotificationDeliveryDocument>('NotificationDelivery', schema);
