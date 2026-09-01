import { Schema, model, Types } from 'mongoose';

export type StudySessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';

export interface StudySessionDocument {
  ownerId: Types.ObjectId;
  lessonId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  status: StudySessionStatus;
  startedAt: Date;
  endedAt?: Date;
  lastResumedAt?: Date;
  elapsedSeconds: number;
  pauseCount: number;
  reflection?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<StudySessionDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Lesson' },
  learningPathId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'LearningPath' },
  status: { type: String, enum: ['ACTIVE','PAUSED','COMPLETED','ABANDONED'], default: 'ACTIVE', index: true },
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: Date,
  lastResumedAt: Date,
  elapsedSeconds: { type: Number, min: 0, default: 0 },
  pauseCount: { type: Number, min: 0, default: 0 },
  reflection: { type: String, trim: true, maxlength: 3000 }
}, { timestamps: true });

schema.index({ ownerId: 1, lessonId: 1, status: 1 });
schema.index({ ownerId: 1, startedAt: -1 });
export const StudySessionModel = model<StudySessionDocument>('StudySession', schema);
