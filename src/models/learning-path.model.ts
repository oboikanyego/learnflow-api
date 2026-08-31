import { Schema, model, type Types } from 'mongoose';

export type LearningPathStatus = 'BACKLOG' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface LearningPathDocument {
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  status: LearningPathStatus;
  createdAt: Date;
  updatedAt: Date;
}

const learningPathSchema = new Schema<LearningPathDocument>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['BACKLOG', 'ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'BACKLOG' }
}, { timestamps: true });

learningPathSchema.index({ ownerId: 1, createdAt: -1 });
export const LearningPathModel = model<LearningPathDocument>('LearningPath', learningPathSchema);
