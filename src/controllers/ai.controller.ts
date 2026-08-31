import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { UserModel } from '../models/user.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { localDateTimeToUtc } from '../utils/timezone.js';
import { generateAiText, getAiProviderInfo } from '../services/ai-provider.service.js';
import { sendPlanCreatedEmail } from '../services/learning-email.service.js';

const requestSchema=z.object({topic:z.string().min(2).max(120),weeks:z.number().int().min(1).max(52),days:z.array(z.string()).min(1).max(7),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),durationMinutes:z.number().int().min(15).max(240).default(60),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),save:z.boolean().default(false)});
const coachSchema=z.object({message:z.string().min(2).max(4000),context:z.string().max(4000).optional()});
const planSchema=z.object({learningPath:z.object({title:z.string().min(2),description:z.string().optional()}),phases:z.array(z.object({title:z.string().min(1),modules:z.array(z.object({title:z.string().min(1),lessons:z.array(z.object({title:z.string().min(1),description:z.string().optional(),date:z.string(),time:z.string(),durationMinutes:z.number().int().min(5).max(480),resourceUrl:z.string().optional()}))}))}))});

type PlanInput = z.infer<typeof requestSchema>;

async function persistPlan(ownerId:string,timezone:string,rawPlan:unknown){const plan=planSchema.parse(rawPlan);const path=await LearningPathModel.create({ownerId,title:plan.learningPath.title,description:plan.learningPath.description,status:'ACTIVE'});let lessonCount=0;for(let p=0;p<plan.phases.length;p++){const phaseData=plan.phases[p]!;const phase=await PhaseModel.create({ownerId,learningPathId:path._id,title:phaseData.title,position:p});for(let m=0;m<phaseData.modules.length;m++){const moduleData=phaseData.modules[m]!;const module=await ModuleModel.create({ownerId,learningPathId:path._id,phaseId:phase._id,title:moduleData.title,position:m});for(let l=0;l<moduleData.lessons.length;l++){const lesson=moduleData.lessons[l]!;const scheduledAt=localDateTimeToUtc(lesson.date,lesson.time,timezone);await LessonModel.create({ownerId,learningPathId:path._id,phaseId:phase._id,moduleId:module._id,title:lesson.title,description:lesson.description,resourceUrl:lesson.resourceUrl||undefined,durationMinutes:lesson.durationMinutes,position:l,scheduledAt,status:scheduledAt?'SCHEDULED':'BACKLOG'});lessonCount++;}}}void sendPlanCreatedEmail({ownerId,learningPathId:path.id,title:path.title,source:'ai',lessonCount});return path._id;}

function buildPlanPrompt(input:PlanInput,timezone:string){return `Create a practical learning plan for ${input.topic}. Duration: ${input.weeks} weeks. Study days: ${input.days.join(', ')}. Start date: ${input.startDate}. Study time: ${input.time} in timezone ${timezone}. Session duration: ${input.durationMinutes} minutes. Return ONLY valid JSON with shape {"learningPath":{"title":"...","description":"..."},"phases":[{"title":"...","modules":[{"title":"...","lessons":[{"title":"...","description":"...","date":"YYYY-MM-DD","time":"HH:mm","durationMinutes":60,"resourceUrl":""}]}]}]}. Keep lessons realistic and ordered. Do not include markdown fences.`;}

async function createPlan(input:PlanInput,timezone:string){const text=await generateAiText(buildPlanPrompt(input,timezone));return planSchema.parse(JSON.parse(text.replace(/^```json\s*|```$/g,'').trim()));}

async function processPlanJob(jobId:string,ownerId:string,timezone:string,input:PlanInput){
  try{
    await AiPlanJobModel.findOneAndUpdate({_id:jobId,ownerId},{status:'PROCESSING',startedAt:new Date(),errorMessage:undefined,completedAt:undefined});
    const parsed=await createPlan(input,timezone);
    const learningPathId=input.save?await persistPlan(ownerId,timezone,parsed):undefined;
    await AiPlanJobModel.findOneAndUpdate({_id:jobId,ownerId},{status:'COMPLETED',plan:parsed,learningPathId,completedAt:new Date()});
    await NotificationModel.create({ownerId,type:'AI_PLAN_READY',title:'Your learning plan is ready',message:`The ${parsed.learningPath.title} roadmap has finished generating. You can preview it now.`,actionUrl:`/ai-planner?job=${jobId}`});
  }catch(error){
    const message=error instanceof Error?error.message:'Learning plan generation failed';
    await AiPlanJobModel.findOneAndUpdate({_id:jobId,ownerId},{status:'FAILED',errorMessage:message.slice(0,500),completedAt:new Date()});
    await NotificationModel.create({ownerId,type:'AI_PLAN_FAILED',title:'Learning plan generation failed',message:'We could not finish generating your learning plan. Open AI requests to retry it.',actionUrl:'/ai-requests'});
  }
}

async function getUserTimezone(userId:string){const user=await UserModel.findById(userId).select('timezone').lean();if(!user)throw Object.assign(new Error('User not found'),{statusCode:404});return user.timezone;}

export async function generatePlan(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const input=requestSchema.parse(req.body);const provider=getAiProviderInfo();if(!provider.configured)return res.status(503).json({message:`AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.`});const timezone=await getUserTimezone(req.user!.id);const parsed=await createPlan(input,timezone);const learningPathId=input.save?await persistPlan(req.user!.id,timezone,parsed):undefined;res.json({plan:parsed,learningPathId,timezone,provider:provider.provider});}catch(error){next(error);}}

export async function queuePlan(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const input=requestSchema.parse(req.body);const provider=getAiProviderInfo();if(!provider.configured)return res.status(503).json({message:`AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.`});const timezone=await getUserTimezone(req.user!.id);const job=await AiPlanJobModel.create({ownerId:req.user!.id,status:'QUEUED',input});setImmediate(()=>{void processPlanJob(job.id,req.user!.id,timezone,input);});res.status(202).json({jobId:job.id,status:job.status,message:'Your learning plan is generating in the background. You can continue using LearnFlow and we will notify you when it is ready.'});}catch(error){next(error);}}

export async function retryPlanJob(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const provider=getAiProviderInfo();if(!provider.configured)return res.status(503).json({message:`AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.`});const source=await AiPlanJobModel.findOne({_id:req.params.id,ownerId:req.user!.id}).lean();if(!source)return res.status(404).json({message:'Learning plan job not found'});if(source.status!=='FAILED')return res.status(409).json({message:'Only failed learning plan requests can be retried.'});const timezone=await getUserTimezone(req.user!.id);const input=requestSchema.parse(source.input);const retry=await AiPlanJobModel.create({ownerId:req.user!.id,status:'QUEUED',input});setImmediate(()=>{void processPlanJob(retry.id,req.user!.id,timezone,input);});res.status(202).json({jobId:retry.id,status:retry.status,retryOf:source._id,message:'Retry started. You can continue using LearnFlow and we will notify you when it finishes.'});}catch(error){next(error);}}

export async function listPlanJobs(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const jobs=await AiPlanJobModel.find({ownerId:req.user!.id}).sort({createdAt:-1}).limit(100).lean();res.json(jobs);}catch(error){next(error);}}

export async function getPlanJob(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const job=await AiPlanJobModel.findOne({_id:req.params.id,ownerId:req.user!.id}).lean();if(!job)return res.status(404).json({message:'Learning plan job not found'});res.json(job);}catch(error){next(error);}}

export async function coach(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const input=coachSchema.parse(req.body);const provider=getAiProviderInfo();if(!provider.configured)return res.status(503).json({message:`AI coach is not configured for ${provider.provider}. Configure an AI provider key on Render.`});const prompt=`You are the LearnFlow learning coach. Help the learner understand concepts, unblock study sessions, break work into realistic next steps, and improve consistency. Do not claim to have changed their LearnFlow data and do not invent completion status. Keep the response concise and practical.\n\nOptional learner context:\n${input.context??'No extra context supplied.'}\n\nLearner message:\n${input.message}`;const answer=await generateAiText(prompt);res.json({answer,provider:provider.provider});}catch(error){next(error);}}

export async function providerStatus(_req:AuthenticatedRequest,res:Response){res.json(getAiProviderInfo());}
