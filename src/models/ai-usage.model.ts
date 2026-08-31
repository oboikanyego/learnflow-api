import { Schema, model } from 'mongoose';

export type AiUsageFeature = 'PLAN' | 'COACH';
export type AiUsageStatus = 'ACCEPTED' | 'SUCCEEDED' | 'FAILED' | 'REJECTED_QUOTA';

const aiUsageSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  feature: { type: String, enum: ['PLAN', 'COACH'], required: true, index: true },
  status: { type: String, enum: ['ACCEPTED', 'SUCCEEDED', 'FAILED', 'REJECTED_QUOTA'], required: true, index: true },
  provider: { type: String, enum: ['openai', 'groq', 'gemini'], required: true, index: true },
  model: { type: String, required: true },
  jobId: { type: Schema.Types.ObjectId, index: true },
  requestKey: { type: String, index: true },
  errorMessage: { type: String, maxlength: 500 },
  startedAt: { type: Date, default: Date.now, required: true },
  completedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

aiUsageSchema.index({ ownerId: 1, feature: 1, createdAt: -1 });
aiUsageSchema.index({ ownerId: 1, createdAt: -1 });
aiUsageSchema.index({ provider: 1, feature: 1, createdAt: -1 });

export const AiUsageModel = model('AiUsage', aiUsageSchema);
