import { Schema, model, Types } from 'mongoose';

export const lessonStatuses = ['BACKLOG','SCHEDULED','IN_PROGRESS','COMPLETED','MISSED','SKIPPED'] as const;
export type LessonStatus = typeof lessonStatuses[number];

export interface LessonDocument {
  ownerId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  phaseId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  description?: string;
  resourceUrl?: string;
  position: number;
  status: LessonStatus;
  scheduledAt?: Date;
  durationMinutes: number;
  reminderMinutes: number;
  reminderSentAt?: Date;
  missedAt?: Date;
  completedAt?: Date;
  evidenceUrl?: string;
  notes?: string;
  confidenceScore?: number;
  reviewStage: number;
  nextReviewAt?: Date;
  lastReviewedAt?: Date;
  reviewCount: number;
  masteryScore?: number;
  assessmentAttempts: number;
  lastAssessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<LessonDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  learningPathId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'LearningPath' },
  phaseId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Phase' },
  moduleId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Module' },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000 },
  resourceUrl: { type: String, trim: true },
  position: { type: Number, required: true, min: 0 },
  status: { type: String, enum: lessonStatuses, default: 'BACKLOG', index: true },
  scheduledAt: { type: Date, index: true },
  durationMinutes: { type: Number, min: 5, max: 480, default: 60 },
  reminderMinutes: { type: Number, min: 0, max: 10080, default: 15 },
  reminderSentAt: Date,
  missedAt: Date,
  completedAt: Date,
  evidenceUrl: String,
  notes: { type: String, maxlength: 5000 },
  confidenceScore: { type: Number, min: 1, max: 5 },
  reviewStage: { type: Number, min: 0, max: 10, default: 0 },
  nextReviewAt: { type: Date, index: true },
  lastReviewedAt: Date,
  reviewCount: { type: Number, min: 0, default: 0 },
  masteryScore: { type: Number, min: 0, max: 100 },
  assessmentAttempts: { type: Number, min: 0, default: 0 },
  lastAssessedAt: Date
}, { timestamps: true });
schema.index({ ownerId: 1, moduleId: 1, position: 1 });
schema.index({ status: 1, scheduledAt: 1, reminderSentAt: 1 });
schema.index({ ownerId: 1, nextReviewAt: 1 });
schema.index({ ownerId: 1, masteryScore: 1 });
export const LessonModel = model<LessonDocument>('Lesson', schema);
