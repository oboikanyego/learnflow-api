import { Schema, Types, model } from 'mongoose';

export type UserMessageType = 'CONTACT' | 'FEEDBACK' | 'SUPPORT';
export type UserMessageStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface UserMessageDocument {
  type: UserMessageType;
  user?: Types.ObjectId;
  name: string;
  email: string;
  subject: string;
  message: string;
  rating?: number;
  category?: string;
  status: UserMessageStatus;
  notificationStatus: 'SENT' | 'PARTIAL' | 'SKIPPED' | 'FAILED';
  notifiedAdminCount: number;
  providerMessageIds: string[];
  notificationError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userMessageSchema = new Schema<UserMessageDocument>({
  type: { type: String, enum: ['CONTACT', 'FEEDBACK', 'SUPPORT'], required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
  rating: { type: Number, min: 1, max: 5 },
  category: { type: String, trim: true, maxlength: 80 },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'], default: 'OPEN', index: true },
  notificationStatus: { type: String, enum: ['SENT', 'PARTIAL', 'SKIPPED', 'FAILED'], default: 'SKIPPED' },
  notifiedAdminCount: { type: Number, default: 0, min: 0 },
  providerMessageIds: [{ type: String, trim: true }],
  notificationError: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

userMessageSchema.index({ createdAt: -1, type: 1 });

export const UserMessageModel = model<UserMessageDocument>('UserMessage', userMessageSchema);
