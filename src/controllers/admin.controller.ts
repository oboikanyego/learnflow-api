import type { Response,NextFunction } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { NotificationDeliveryModel } from '../models/notification-delivery.model.js';
import { getAiPlanQueueHealth } from '../services/ai-plan-queue.service.js';
import { getAdminAiUsageOverview } from '../services/ai-usage.service.js';
import { enrichAdminUsers, deleteInactiveUserAccount } from '../services/admin-user-management.service.js';
import { changeUserEntitlement, entitlementCapabilities, listEntitlementHistory, normalizeEntitlement } from '../services/entitlement.service.js';

const entitlementSchema=z.object({plan:z.enum(['FREE','PRO']),status:z.enum(['ACTIVE','INACTIVE','GRACE']),reason:z.string().trim().min(3).max(300),startsAt:z.coerce.date().optional(),endsAt:z.coerce.date().optional()});
const deleteUserSchema=z.object({reason:z.string().trim().min(5).max(500),confirmation:z.literal('DELETE')});

export async function getAdminOverview(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const now=new Date();const activeNowSince=new Date(now.getTime()-5*60_000);const active24hSince=new Date(now.getTime()-24*60*60_000);const thirtyDaysAgo=new Date(now.getTime()-29*24*60*60_000);thirtyDaysAgo.setUTCHours(0,0,0,0);const delivery24hSince=new Date(now.getTime()-24*60*60_000);
    const [totalUsers,activeNow,active24h,totalPaths,totalLessons,recentUsers,registrations,deliveryRows,recentDeliveryFailures,queueHealth,aiUsage,proUsers]=await Promise.all([
      UserModel.countDocuments(),UserModel.countDocuments({lastSeenAt:{$gte:activeNowSince}}),UserModel.countDocuments({lastSeenAt:{$gte:active24hSince}}),LearningPathModel.countDocuments(),LessonModel.countDocuments(),UserModel.find().sort({createdAt:-1}).limit(12).select('name email role entitlement createdAt lastSeenAt').lean(),UserModel.aggregate([{$match:{createdAt:{$gte:thirtyDaysAgo}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]),NotificationDeliveryModel.aggregate([{$match:{createdAt:{$gte:delivery24hSince}}},{$group:{_id:'$status',count:{$sum:1}}}]),NotificationDeliveryModel.find({status:'FAILED'}).sort({updatedAt:-1}).limit(10).select('eventType channel provider attemptCount errorMessage updatedAt').lean(),getAiPlanQueueHealth(),getAdminAiUsageOverview(),UserModel.countDocuments({'entitlement.plan':'PRO','entitlement.status':{$in:['ACTIVE','GRACE']}})
    ]);
    const counts=new Map(registrations.map((r:{_id:string;count:number})=>[r._id,r.count]));const registrationTrend=Array.from({length:30},(_,i)=>{const d=new Date(thirtyDaysAgo);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);return {date,count:counts.get(date)??0};});const deliveryCounts=new Map(deliveryRows.map((r:{_id:string;count:number})=>[r._id,r.count]));const sent=deliveryCounts.get('SENT')??0;const failed=deliveryCounts.get('FAILED')??0;const pending=deliveryCounts.get('PENDING')??0;const skipped=deliveryCounts.get('SKIPPED')??0;const attempted=sent+failed;const deliveryRate=attempted?Math.round(sent/attempted*100):100;const retryBacklog=await NotificationDeliveryModel.countDocuments({status:'FAILED',nextAttemptAt:{$exists:true,$lte:now},attemptCount:{$lt:3}});
    res.json({totalUsers,activeNow,active24h,totalPaths,totalLessons,proUsers,registrationTrend,recentUsers:recentUsers.map(user=>({...user,entitlement:normalizeEntitlement(user.entitlement)})),notificationHealth:{sent,failed,pending,skipped,retryBacklog,deliveryRate,recentFailures:recentDeliveryFailures},queueHealth,aiUsage});
  }catch(error){next(error);}
}

export async function listAdminUsers(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const query=String(req.query.q??'').trim();
    const filter=query?{$or:[{name:{$regex:query,$options:'i'}},{email:{$regex:query,$options:'i'}}]}:{};
    const users=await UserModel.find(filter).sort({lastSeenAt:-1,createdAt:-1}).limit(100).select('name email role timezone entitlement createdAt lastSeenAt').lean();
    const normalized=users.map(user=>({...user,entitlement:normalizeEntitlement(user.entitlement),capabilities:entitlementCapabilities(user.entitlement)}));
    res.json(await enrichAdminUsers(normalized));
  }catch(error){next(error);}
}

export async function updateAdminEntitlement(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const input=entitlementSchema.parse(req.body);if(input.endsAt&&input.startsAt&&input.endsAt<=input.startsAt)return res.status(400).json({message:'Entitlement end date must be after the start date.'});res.json(await changeUserEntitlement({userId:String(req.params.id),changedBy:req.user!.id,...input}));}catch(error){next(error);}}

export async function getAdminEntitlementHistory(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json(await listEntitlementHistory(String(req.params.id)));}catch(error){next(error);}}

export async function deleteAdminUser(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const input=deleteUserSchema.parse(req.body);
    res.json(await deleteInactiveUserAccount({targetUserId:String(req.params.id),performedBy:req.user!.id,reason:input.reason}));
  }catch(error){next(error);}
}
