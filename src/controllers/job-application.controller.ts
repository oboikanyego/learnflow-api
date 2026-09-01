import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { JobApplicationModel } from '../models/job-application.model.js';
import { JobAnalysisModel } from '../models/job-match.model.js';

const stageSchema = z.enum(['SAVED','APPLIED','SCREENING','INTERVIEW','TECHNICAL','OFFER','REJECTED','WITHDRAWN']);
const createSchema = z.object({
  title: z.string().min(2).max(160), company: z.string().min(2).max(160),
  jobAnalysisId: z.string().refine(Types.ObjectId.isValid).optional(), source: z.string().max(120).optional(), applicationUrl: z.string().url().optional(),
  stage: stageSchema.default('SAVED'), appliedAt: z.coerce.date().optional(), nextFollowUpAt: z.coerce.date().optional(), recruiterName: z.string().max(160).optional(), recruiterEmail: z.string().email().optional()
});
const updateSchema = createSchema.partial();
const noteSchema = z.object({ body: z.string().min(1).max(3000) });
const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid application id');

async function ownedAnalysis(ownerId: string, analysisId?: string) {
  if (!analysisId) return null;
  return JobAnalysisModel.findOne({ _id: analysisId, ownerId }).lean();
}

export async function listApplications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const rows = await JobApplicationModel.find({ ownerId: req.user!.id }).sort({ updatedAt: -1 }).lean();
    const counts = rows.reduce<Record<string, number>>((acc,row)=>{acc[row.stage]=(acc[row.stage]??0)+1;return acc;},{});
    res.json({ counts, applications: rows.map(row => ({ ...row, id: String(row._id), jobAnalysisId: row.jobAnalysisId ? String(row.jobAnalysisId) : null })) });
  } catch (error) { next(error); }
}

export async function createApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const input = createSchema.parse(req.body);
    if (input.jobAnalysisId && !(await ownedAnalysis(ownerId, input.jobAnalysisId))) return res.status(404).json({ message: 'Job analysis not found.' });
    const row = await JobApplicationModel.create({ ...input, ownerId });
    res.status(201).json({ ...row.toObject(), id: String(row._id) });
  } catch (error) { next(error); }
}

export async function updateApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id; const id = idSchema.parse(req.params.applicationId); const input = updateSchema.parse(req.body);
    if (input.jobAnalysisId && !(await ownedAnalysis(ownerId, input.jobAnalysisId))) return res.status(404).json({ message: 'Job analysis not found.' });
    const row = await JobApplicationModel.findOneAndUpdate({ _id:id, ownerId }, input, { new:true, runValidators:true });
    if (!row) return res.status(404).json({ message:'Application not found.' });
    res.json({ ...row.toObject(), id:String(row._id) });
  } catch (error) { next(error); }
}

export async function addApplicationNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId=req.user!.id; const id=idSchema.parse(req.params.applicationId); const { body }=noteSchema.parse(req.body);
    const row=await JobApplicationModel.findOneAndUpdate({ _id:id, ownerId }, { $push:{ notes:{ body, createdAt:new Date() } } }, { new:true });
    if(!row) return res.status(404).json({message:'Application not found.'});
    res.json(row.notes);
  } catch(error){next(error);}
}

export async function getInterviewPrep(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId=req.user!.id; const id=idSchema.parse(req.params.applicationId);
    const app=await JobApplicationModel.findOne({ _id:id, ownerId }).lean();
    if(!app) return res.status(404).json({message:'Application not found.'});
    const analysis=app.jobAnalysisId ? await ownedAnalysis(ownerId,String(app.jobAnalysisId)) : null;
    res.json({
      application:{ id:String(app._id), title:app.title, company:app.company, stage:app.stage, recruiterName:app.recruiterName, nextFollowUpAt:app.nextFollowUpAt },
      talkingPoints:analysis?.talkingPoints ?? [], interviewQuestions:analysis?.interviewQuestions ?? [],
      preparationChecklist:['Prepare a 60-second introduction for this role.','Review every evidence-backed talking point.','Prepare STAR examples for ownership, collaboration and problem solving.','Write 3 questions to ask the interviewer.','Review the role gaps before the interview.'],
      hasJobAnalysis:!!analysis
    });
  } catch(error){next(error);}
}

export async function deleteApplication(req: AuthenticatedRequest,res:Response,next:NextFunction){
  try{const row=await JobApplicationModel.findOneAndDelete({_id:idSchema.parse(req.params.applicationId),ownerId:req.user!.id});if(!row)return res.status(404).json({message:'Application not found.'});res.status(204).send();}catch(error){next(error);}
}
