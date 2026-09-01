import { Schema, model, Types } from 'mongoose';

export type SkillLevel = 'FOUNDATION' | 'WORKING' | 'STRONG';
export type EvidenceType = 'LESSON' | 'PROJECT' | 'CERTIFICATE' | 'LINK';

export interface CareerTargetDocument {
  ownerId: Types.ObjectId;
  roleTitle: string;
  description?: string;
  requiredSkills: Array<{ name: string; targetLevel: SkillLevel }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillEvidenceDocument {
  ownerId: Types.ObjectId;
  skillName: string;
  evidenceType: EvidenceType;
  title: string;
  description?: string;
  url?: string;
  lessonId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const careerTargetSchema = new Schema<CareerTargetDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
  roleTitle: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
  requiredSkills: [{
    name: { type: String, required: true, trim: true, maxlength: 80 },
    targetLevel: { type: String, enum: ['FOUNDATION', 'WORKING', 'STRONG'], required: true }
  }]
}, { timestamps: true });

const skillEvidenceSchema = new Schema<SkillEvidenceDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  skillName: { type: String, required: true, trim: true, maxlength: 80, index: true },
  evidenceType: { type: String, enum: ['LESSON', 'PROJECT', 'CERTIFICATE', 'LINK'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 1500 },
  url: { type: String, trim: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', index: true }
}, { timestamps: true });

skillEvidenceSchema.index({ ownerId: 1, skillName: 1, createdAt: -1 });

export const CareerTargetModel = model<CareerTargetDocument>('CareerTarget', careerTargetSchema);
export const SkillEvidenceModel = model<SkillEvidenceDocument>('SkillEvidence', skillEvidenceSchema);
