import { Schema, model, type Types } from 'mongoose';

export type LearningGoalStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface LearningGoalDocument {
  ownerId: Types.ObjectId;
  learningPathId?: Types.ObjectId;
  title: string;
  description?: string;
  targetDate?: Date;
  weeklyMinutesTarget: number;
  status: LearningGoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const learningGoalSchema = new Schema<LearningGoalDocument>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  learningPathId: { type: Schema.Types.ObjectId, ref: 'LearningPath', index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1200 },
  targetDate: Date,
  weeklyMinutesTarget: { type: Number, required: true, min: 30, max: 10080, default: 360 },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE', index: true }
}, { timestamps: true });

learningGoalSchema.index({ ownerId: 1, status: 1, targetDate: 1 });
export const LearningGoalModel = model<LearningGoalDocument>('LearningGoal', learningGoalSchema);
