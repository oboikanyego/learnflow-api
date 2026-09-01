import { Schema, model, Types } from 'mongoose';

export type ApplicationStage = 'SAVED'|'APPLIED'|'SCREENING'|'INTERVIEW'|'TECHNICAL'|'OFFER'|'REJECTED'|'WITHDRAWN';

export interface JobApplicationDocument {
  ownerId: Types.ObjectId;
  jobAnalysisId?: Types.ObjectId;
  title: string;
  company: string;
  source?: string;
  applicationUrl?: string;
  stage: ApplicationStage;
  appliedAt?: Date;
  nextFollowUpAt?: Date;
  recruiterName?: string;
  recruiterEmail?: string;
  notes: Array<{ body: string; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema({ body: { type: String, required: true, trim: true, maxlength: 3000 }, createdAt: { type: Date, default: Date.now } }, { _id: false });

const schema = new Schema<JobApplicationDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  jobAnalysisId: { type: Schema.Types.ObjectId, ref: 'JobAnalysis', index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  company: { type: String, required: true, trim: true, maxlength: 160 },
  source: { type: String, trim: true, maxlength: 120 },
  applicationUrl: { type: String, trim: true },
  stage: { type: String, enum: ['SAVED','APPLIED','SCREENING','INTERVIEW','TECHNICAL','OFFER','REJECTED','WITHDRAWN'], default: 'SAVED', index: true },
  appliedAt: Date,
  nextFollowUpAt: Date,
  recruiterName: { type: String, trim: true, maxlength: 160 },
  recruiterEmail: { type: String, trim: true, maxlength: 320 },
  notes: { type: [noteSchema], default: [] }
}, { timestamps: true });

schema.index({ ownerId: 1, stage: 1, updatedAt: -1 });
export const JobApplicationModel = model<JobApplicationDocument>('JobApplication', schema);
