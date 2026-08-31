import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { NotificationDeliveryModel } from '../models/notification-delivery.model.js';
import { getAiPlanQueueHealth } from '../services/ai-plan-queue.service.js';

export async function getAdminOverview(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const now=new Date();
    const activeNowSince=new Date(now.getTime()-5*60_000);
    const active24hSince=new Date(now.getTime()-24*60*60_000);
    const thirtyDaysAgo=new Date(now.getTime()-29*24*60*60_000);thirtyDaysAgo.setUTCHours(0,0,0,0);
    const delivery24hSince=new Date(now.getTime()-24*60*60_000);
    const [totalUsers,activeNow,active24h,totalPaths,totalLessons,recentUsers,registrations,deliveryRows,recentDeliveryFailures,queueHealth]=await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({lastSeenAt:{$gte:activeNowSince}}),
      UserModel.countDocuments({lastSeenAt:{$gte:active24hSince}}),
      LearningPathModel.countDocuments(),
      LessonModel.countDocuments(),
      UserModel.find().sort({createdAt:-1}).limit(12).select('name email role createdAt lastSeenAt').lean(),
      UserModel.aggregate([{$match:{createdAt:{$gte:thirtyDaysAgo}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]),
      NotificationDeliveryModel.aggregate([{$match:{createdAt:{$gte:delivery24hSince}}},{$group:{_id:'$status',count:{$sum:1}}}]),
      NotificationDeliveryModel.find({status:'FAILED'}).sort({updatedAt:-1}).limit(10).select('eventType channel provider attemptCount errorMessage updatedAt').lean(),
      getAiPlanQueueHealth()
    ]);
    const counts=new Map(registrations.map((r:{_id:string;count:number})=>[r._id,r.count]));
    const registrationTrend=Array.from({length:30},(_,i)=>{const d=new Date(thirtyDaysAgo);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);return {date,count:counts.get(date)??0};});
    const deliveryCounts=new Map(deliveryRows.map((r:{_id:string;count:number})=>[r._id,r.count]));
    const sent=deliveryCounts.get('SENT')??0;
    const failed=deliveryCounts.get('FAILED')??0;
    const pending=deliveryCounts.get('PENDING')??0;
    const skipped=deliveryCounts.get('SKIPPED')??0;
    const attempted=sent+failed;
    const deliveryRate=attempted?Math.round(sent/attempted*100):100;
    const retryBacklog=await NotificationDeliveryModel.countDocuments({status:'FAILED',nextAttemptAt:{$exists:true,$lte:now},attemptCount:{$lt:3}});
    res.json({
      totalUsers,activeNow,active24h,totalPaths,totalLessons,registrationTrend,recentUsers,
      notificationHealth:{sent,failed,pending,skipped,retryBacklog,deliveryRate,recentFailures:recentDeliveryFailures},
      queueHealth
    });
  }catch(error){next(error);}
}
