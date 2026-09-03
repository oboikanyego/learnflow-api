import { Schema, model } from 'mongoose';

export type SystemLimitCategory = 'AI' | 'YOUTUBE' | 'ACCOUNT';

export interface SystemLimitDocument {
  key: string;
  category: SystemLimitCategory;
  label: string;
  description: string;
  value: number;
  minValue: number;
  maxValue: number;
  unit: string;
  enabled: boolean;
  updatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const systemLimitSchema = new Schema<SystemLimitDocument>({
  key: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  category: { type: String, enum: ['AI', 'YOUTUBE', 'ACCOUNT'], required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  value: { type: Number, required: true, min: 0 },
  minValue: { type: Number, required: true, min: 0 },
  maxValue: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  enabled: { type: Boolean, default: true, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

systemLimitSchema.pre('validate', function(next) {
  if (this.maxValue < this.minValue) return next(new Error('maxValue must be greater than or equal to minValue'));
  if (this.value < this.minValue || this.value > this.maxValue) return next(new Error('value must be within the configured range'));
  next();
});

export const SystemLimitModel = model<SystemLimitDocument>('SystemLimit', systemLimitSchema);
