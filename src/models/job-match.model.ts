import { Schema, model } from 'mongoose';
import type { SkillLevel } from './career.model.js';

export interface JobRequirement {
  name: string;
  targetLevel: SkillLevel;
  importance: 'REQUIRED' | 'PREFERRED';
}

export interface JobAnalysisDocument {
  ownerId: Schema.Types.ObjectId;
  title: string;
  company?: string;
  jobDescription: string;
  requirements: JobRequirement[];
  talkingPoints: string[];
  interviewQuestions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<JobRequirement>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  targetLevel: { type: String, enum: ['FOUNDATION', 'WORKING', 'STRONG'], required: true },
  importance: { type: String, enum: ['REQUIRED', 'PREFERRED'], default: 'REQUIRED' }
}, { _id: false });

const jobAnalysisSchema = new Schema<JobAnalysisDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  company: { type: String, trim: true, maxlength: 160 },
  jobDescription: { type: String, required: true, maxlength: 20000 },
  requirements: { type: [requirementSchema], default: [] },
  talkingPoints: { type: [String], default: [] },
  interviewQuestions: { type: [String], default: [] }
}, { timestamps: true });

jobAnalysisSchema.index({ ownerId: 1, createdAt: -1 });
export const JobAnalysisModel = model<JobAnalysisDocument>('JobAnalysis', jobAnalysisSchema);
