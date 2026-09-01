import { Schema, model, Types } from 'mongoose';

export type OfferStatus = 'ACTIVE'|'ACCEPTED'|'DECLINED'|'EXPIRED';
export type EmploymentType = 'PERMANENT'|'FIXED_TERM'|'CONTRACTOR'|'OTHER';
export type CareerOutcomeType = 'INTERVIEW_FEEDBACK'|'REJECTION'|'OFFER'|'ACCEPTANCE'|'WITHDRAWAL';

export interface CareerOfferDocument {
  ownerId: Types.ObjectId;
  applicationId: Types.ObjectId;
  currency: string;
  monthlyBase: number;
  monthlyBenefitsValue: number;
  annualBonus: number;
  employmentType: EmploymentType;
  contractMonths?: number;
  leaveDays?: number;
  remotePolicy?: string;
  officeDaysPerWeek?: number;
  medicalAid: boolean;
  retirementContribution: boolean;
  equity: boolean;
  roleFitRating: number;
  growthRating: number;
  stabilityRating: number;
  flexibilityRating: number;
  compensationRating: number;
  notes?: string;
  status: OfferStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerOutcomeDocument {
  ownerId: Types.ObjectId;
  applicationId: Types.ObjectId;
  type: CareerOutcomeType;
  summary: string;
  strengths: string[];
  skillGaps: string[];
  learningActions: string[];
  interviewStage?: string;
  happenedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<CareerOfferDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  applicationId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'JobApplication' },
  currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 8, default: 'ZAR' },
  monthlyBase: { type: Number, required: true, min: 0 },
  monthlyBenefitsValue: { type: Number, default: 0, min: 0 },
  annualBonus: { type: Number, default: 0, min: 0 },
  employmentType: { type: String, enum: ['PERMANENT','FIXED_TERM','CONTRACTOR','OTHER'], required: true },
  contractMonths: { type: Number, min: 1, max: 120 },
  leaveDays: { type: Number, min: 0, max: 365 },
  remotePolicy: { type: String, trim: true, maxlength: 180 },
  officeDaysPerWeek: { type: Number, min: 0, max: 7 },
  medicalAid: { type: Boolean, default: false },
  retirementContribution: { type: Boolean, default: false },
  equity: { type: Boolean, default: false },
  roleFitRating: { type: Number, min: 1, max: 5, default: 3 },
  growthRating: { type: Number, min: 1, max: 5, default: 3 },
  stabilityRating: { type: Number, min: 1, max: 5, default: 3 },
  flexibilityRating: { type: Number, min: 1, max: 5, default: 3 },
  compensationRating: { type: Number, min: 1, max: 5, default: 3 },
  notes: { type: String, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['ACTIVE','ACCEPTED','DECLINED','EXPIRED'], default: 'ACTIVE', index: true },
  expiresAt: Date
}, { timestamps: true });
offerSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
offerSchema.index({ ownerId: 1, applicationId: 1 });

const outcomeSchema = new Schema<CareerOutcomeDocument>({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  applicationId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'JobApplication' },
  type: { type: String, enum: ['INTERVIEW_FEEDBACK','REJECTION','OFFER','ACCEPTANCE','WITHDRAWAL'], required: true, index: true },
  summary: { type: String, required: true, trim: true, maxlength: 4000 },
  strengths: { type: [String], default: [] },
  skillGaps: { type: [String], default: [] },
  learningActions: { type: [String], default: [] },
  interviewStage: { type: String, trim: true, maxlength: 120 },
  happenedAt: { type: Date, default: Date.now }
}, { timestamps: true });
outcomeSchema.index({ ownerId: 1, happenedAt: -1 });
outcomeSchema.index({ ownerId: 1, applicationId: 1, happenedAt: -1 });

export const CareerOfferModel = model<CareerOfferDocument>('CareerOffer', offerSchema);
export const CareerOutcomeModel = model<CareerOutcomeDocument>('CareerOutcome', outcomeSchema);
