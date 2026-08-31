import { Schema, model, Types } from 'mongoose';

export interface NotificationDocument {
  ownerId: Types.ObjectId;
  lessonId?: Types.ObjectId;
  type: 'REMINDER' | 'MISSED' | 'SYSTEM';
  title: string;
  message: string;
  readAt?: Date;
  createdAt: Date;
}

const schema = new Schema<NotificationDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  type: { type: String, enum: ['REMINDER','MISSED','SYSTEM'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  readAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ ownerId: 1, createdAt: -1 });
export const NotificationModel = model<NotificationDocument>('Notification', schema);
