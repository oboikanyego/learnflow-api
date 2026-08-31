import { Schema, model } from 'mongoose';

export type LearningPathStatus = 'BACKLOG' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface LearningPathDocument {
  title: string;
  description?: string;
  status: LearningPathStatus;
  createdAt: Date;
  updatedAt: Date;
}

const learningPathSchema = new Schema<LearningPathDocument>({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['BACKLOG', 'ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'BACKLOG' }
}, { timestamps: true });

export const LearningPathModel = model<LearningPathDocument>('LearningPath', learningPathSchema);
