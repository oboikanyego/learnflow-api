import { Schema, model, Types } from 'mongoose';

export interface LessonCommentDocument {
  ownerId: Types.ObjectId;
  lessonId: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const lessonCommentSchema = new Schema<LessonCommentDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Lesson' },
  authorId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  authorName: { type: String, required: true, trim: true, maxlength: 80 },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 3000 }
}, { timestamps: true });

lessonCommentSchema.index({ ownerId: 1, lessonId: 1, createdAt: 1 });

export const LessonCommentModel = model<LessonCommentDocument>('LessonComment', lessonCommentSchema);
