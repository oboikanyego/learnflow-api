import { Schema, model, Types } from 'mongoose';

export interface AssessmentQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AssessmentDocument {
  ownerId: Types.ObjectId;
  lessonId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  questions: AssessmentQuestion[];
  source: 'AI';
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentAttemptDocument {
  ownerId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  lessonId: Types.ObjectId;
  answers: number[];
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  weakQuestionIndexes: number[];
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<AssessmentQuestion>({
  prompt: { type: String, required: true, maxlength: 600 },
  options: { type: [String], required: true, validate: { validator: (value: string[]) => value.length === 4, message: 'Assessment questions require exactly four options.' } },
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, required: true, maxlength: 1200 }
}, { _id: false });

const assessmentSchema = new Schema<AssessmentDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Lesson' },
  learningPathId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'LearningPath' },
  questions: { type: [questionSchema], required: true },
  source: { type: String, enum: ['AI'], default: 'AI' }
}, { timestamps: true });
assessmentSchema.index({ ownerId: 1, lessonId: 1, createdAt: -1 });

const attemptSchema = new Schema<AssessmentAttemptDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  assessmentId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Assessment' },
  lessonId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Lesson' },
  answers: { type: [Number], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  correctAnswers: { type: Number, required: true, min: 0 },
  totalQuestions: { type: Number, required: true, min: 1 },
  weakQuestionIndexes: { type: [Number], default: [] },
  completedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });
attemptSchema.index({ ownerId: 1, lessonId: 1, completedAt: -1 });

export const AssessmentModel = model<AssessmentDocument>('Assessment', assessmentSchema);
export const AssessmentAttemptModel = model<AssessmentAttemptDocument>('AssessmentAttempt', attemptSchema);
