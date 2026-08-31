import { Schema, model } from 'mongoose';

export interface UserDocument {
  name: string;
  email: string;
  passwordHash: string;
  timezone: string;
  role: 'learner' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  timezone: { type: String, required: true, default: 'UTC' },
  role: { type: String, enum: ['learner', 'admin'], default: 'learner' }
}, { timestamps: true });

export const UserModel = model<UserDocument>('User', userSchema);
