import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CareerOfferModel, CareerOutcomeModel } from '../models/career-outcome.model.js';
import { JobApplicationModel } from '../models/job-application.model.js';

const id = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const offerSchema = z.object({
  applicationId: id,
  currency: z.string().min(3).max(8).default('ZAR'),
  monthlyBase: z.coerce.number().min(0),
  monthlyBenefitsValue: z.coerce.number().min(0).default(0),
  annualBonus: z.coerce.number().min(0).default(0),
  employmentType: z.enum(['PERMANENT','FIXED_TERM','CONTRACTOR','OTHER']),
  contractMonths: z.coerce.number().int().min(1).max(120).optional(),
  leaveDays: z.coerce.number().min(0).max(365).optional(),
  remotePolicy: z.string().max(180).optional(),
  officeDaysPerWeek: z.coerce.number().min(0).max(7).optional(),
  medicalAid: z.boolean().default(false), retirementContribution: z.boolean().default(false), equity: z.boolean().default(false),
  roleFitRating: z.coerce.number().int().min(1).max(5).default(3), growthRating: z.coerce.number().int().min(1).max(5).default(3),
  stabilityRating: z.coerce.number().int().min(1).max(5).default(3), flexibilityRating: z.coerce.number().int().min(1).max(5).default(3),
  compensationRating: z.coerce.number().int().min(1).max(5).default(3), notes: z.string().max(3000).optional(),
  status: z.enum(['ACTIVE','ACCEPTED','DECLINED','EXPIRED']).default('ACTIVE'), expiresAt: z.coerce.date().optional()
});
const offerUpdateSchema = offerSchema.omit({ applicationId: true }).partial();
const outcomeSchema = z.object({
  applicationId: id,
  type: z.enum(['INTERVIEW_FEEDBACK','REJECTION','OFFER','ACCEPTANCE','WITHDRAWAL']),
  summary: z.string().min(2).max(4000),
  strengths: z.array(z.string().min(1).max(160)).max(20).default([]),
  skillGaps: z.array(z.string().min(1).max(160)).max(20).default([]),
  learningActions: z.array(z.string().min(1).max(240)).max(20).default([]),
  interviewStage: z.string().max(120).optional(), happenedAt: z.coerce.date().default(() => new Date())
});

async function ownedApplication(ownerId: string, applicationId: string) {
  return JobApplicationModel.findOne({ _id: applicationId, ownerId }).select('title company stage').lean();
}

function offerSummary(row: any, application?: any) {
  const annualGuaranteed = Math.round(((row.monthlyBase ?? 0) + (row.monthlyBenefitsValue ?? 0)) * 12 + (row.annualBonus ?? 0));
  const ratings = [row.roleFitRating,row.growthRating,row.stabilityRating,row.flexibilityRating,row.compensationRating].filter((v): v is number => typeof v === 'number');
  const decisionScore = ratings.length ? Math.round((ratings.reduce((a,b)=>a+b,0) / ratings.length) * 20) : 0;
  return { ...row, id: String(row._id), applicationId: String(row.applicationId), annualGuaranteed, decisionScore, application: application ? { id:String(application._id), title:application.title, company:application.company, stage:application.stage } : null };
}

function learningBrief(skillGaps: string[], learningActions: string[]) {
  if (!skillGaps.length && !learningActions.length) return '';
  return [
    ...skillGaps.map(gap => `${gap}: strengthen with focused learning, practice and evidence.`),
    ...learningActions.map(action => `Action: ${action}`)
  ].join('\n');
}

export async function getCareerOutcomeOverview(req: AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;
    const [offers,outcomes]=await Promise.all([
      CareerOfferModel.find({ownerId}).sort({updatedAt:-1}).lean(),
      CareerOutcomeModel.find({ownerId}).sort({happenedAt:-1}).limit(50).lean()
    ]);
    const appIds=[...new Set([...offers.map(x=>String(x.applicationId)),...outcomes.map(x=>String(x.applicationId))])];
    const apps=appIds.length?await JobApplicationModel.find({ownerId,_id:{$in:appIds}}).select('title company stage').lean():[];
    const appMap=new Map(apps.map(app=>[String(app._id),app]));
    const enrichedOffers=offers.map(row=>offerSummary(row,appMap.get(String(row.applicationId))));
    const active=enrichedOffers.filter(row=>row.status==='ACTIVE');
    res.json({
      offers: enrichedOffers,
      comparison: active.slice().sort((a,b)=>b.decisionScore-a.decisionScore || b.annualGuaranteed-a.annualGuaranteed),
      outcomes: outcomes.map(row=>({ ...row,id:String(row._id),applicationId:String(row.applicationId),application:appMap.get(String(row.applicationId))??null,learningBrief:learningBrief(row.skillGaps,row.learningActions) })),
      summary:{ activeOffers:active.length, acceptedOffers:enrichedOffers.filter(x=>x.status==='ACCEPTED').length, rejections:outcomes.filter(x=>x.type==='REJECTION').length, feedbackWithGaps:outcomes.filter(x=>x.skillGaps.length>0).length }
    });
  }catch(error){next(error);}
}

export async function createCareerOffer(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;const input=offerSchema.parse(req.body);const app=await ownedApplication(ownerId,input.applicationId);
    if(!app)return res.status(404).json({message:'Application not found.'});
    const row=await CareerOfferModel.create({...input,ownerId});
    await JobApplicationModel.updateOne({_id:input.applicationId,ownerId},{stage:'OFFER'});
    res.status(201).json(offerSummary(row.toObject(),{...app,_id:input.applicationId,stage:'OFFER'}));
  }catch(error){next(error);}
}

export async function updateCareerOffer(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;const offerId=id.parse(req.params.offerId);const input=offerUpdateSchema.parse(req.body);
    const row=await CareerOfferModel.findOneAndUpdate({_id:offerId,ownerId},input,{new:true,runValidators:true}).lean();
    if(!row)return res.status(404).json({message:'Offer not found.'});
    if(input.status==='ACCEPTED')await JobApplicationModel.updateOne({_id:row.applicationId,ownerId},{stage:'OFFER'});
    const app=await ownedApplication(ownerId,String(row.applicationId));
    res.json(offerSummary(row,app));
  }catch(error){next(error);}
}

export async function deleteCareerOffer(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{const row=await CareerOfferModel.findOneAndDelete({_id:id.parse(req.params.offerId),ownerId:req.user!.id});if(!row)return res.status(404).json({message:'Offer not found.'});res.status(204).send();}catch(error){next(error);}
}

export async function createCareerOutcome(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;const input=outcomeSchema.parse(req.body);const app=await ownedApplication(ownerId,input.applicationId);
    if(!app)return res.status(404).json({message:'Application not found.'});
    const row=await CareerOutcomeModel.create({...input,ownerId});
    const stage=input.type==='REJECTION'?'REJECTED':input.type==='WITHDRAWAL'?'WITHDRAWN':input.type==='OFFER'||input.type==='ACCEPTANCE'?'OFFER':undefined;
    if(stage)await JobApplicationModel.updateOne({_id:input.applicationId,ownerId},{stage});
    res.status(201).json({...row.toObject(),id:String(row._id),applicationId:String(row.applicationId),application:app,learningBrief:learningBrief(row.skillGaps,row.learningActions)});
  }catch(error){next(error);}
}
