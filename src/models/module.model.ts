import { Schema, model, Types } from 'mongoose';

export interface ModuleDocument {
  ownerId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  phaseId: Types.ObjectId;
  title: string;
  description?: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ModuleDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  learningPathId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'LearningPath' },
  phaseId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Phase' },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 1000 },
  position: { type: Number, required: true, min: 0 }
}, { timestamps: true });
schema.index({ ownerId: 1, phaseId: 1, position: 1 });
export const ModuleModel = model<ModuleDocument>('Module', schema);
