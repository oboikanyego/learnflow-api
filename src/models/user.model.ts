import { Schema, model } from 'mongoose';

export interface NotificationPreferences {
  inAppReminders: boolean;
  emailReminders: boolean;
  reminderMinutes: number;
  missedSessionEmails: boolean;
  celebrationEmails: boolean;
}

export type EntitlementPlan = 'FREE' | 'PRO';
export type EntitlementStatus = 'ACTIVE' | 'INACTIVE' | 'GRACE';

export interface Entitlement {
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: 'SYSTEM' | 'ADMIN' | 'BILLING';
  startsAt?: Date;
  endsAt?: Date;
}

export interface UserDocument {
  name: string;
  email: string;
  passwordHash: string;
  timezone: string;
  role: 'learner' | 'admin';
  lastSeenAt?: Date;
  entitlement: Entitlement;
  notificationPreferences: NotificationPreferences;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  timezone: { type: String, required: true, default: 'UTC' },
  role: { type: String, enum: ['learner', 'admin'], default: 'learner' },
  lastSeenAt: { type: Date, index: true },
  entitlement: {
    plan: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'GRACE'], default: 'ACTIVE' },
    source: { type: String, enum: ['SYSTEM', 'ADMIN', 'BILLING'], default: 'SYSTEM' },
    startsAt: { type: Date },
    endsAt: { type: Date }
  },
  notificationPreferences: {
    inAppReminders: { type: Boolean, default: true },
    emailReminders: { type: Boolean, default: true },
    reminderMinutes: { type: Number, default: 30, min: 5, max: 1440 },
    missedSessionEmails: { type: Boolean, default: true },
    celebrationEmails: { type: Boolean, default: true }
  },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false }
}, { timestamps: true });

export const UserModel = model<UserDocument>('User', userSchema);
