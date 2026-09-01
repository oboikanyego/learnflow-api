import { Schema, model, Types } from 'mongoose';

export type AiPlanJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AiPlanJobDocument {
  ownerId: Types.ObjectId;
  status: AiPlanJobStatus;
  input: {
    topic: string;
    weeks: number;
    days: string[];
    time: string;
    durationMinutes: number;
    startDate: string;
    save: boolean;
  };
  plan?: unknown;
  learningPathId?: Types.ObjectId;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AiPlanJobDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'QUEUED', index: true },
  input: {
    topic: { type: String, required: true },
    weeks: { type: Number, required: true },
    days: [{ type: String, required: true }],
    time: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    startDate: { type: String, required: true },
    save: { type: Boolean, required: true, default: false }
  },
  plan: { type: Schema.Types.Mixed },
  learningPathId: { type: Schema.Types.ObjectId, ref: 'LearningPath' },
  errorMessage: String,
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

schema.index({ ownerId: 1, createdAt: -1 });

export const AiPlanJobModel = model<AiPlanJobDocument>('AiPlanJob', schema);
