import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { NotificationDeliveryModel } from '../models/notification-delivery.model.js';

export async function getAdminOverview(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const now=new Date();
    const activeNowSince=new Date(now.getTime()-5*60_000);
    const active24hSince=new Date(now.getTime()-24*60*60_000);
    const thirtyDaysAgo=new Date(now.getTime()-29*24*60*60_000);thirtyDaysAgo.setUTCHours(0,0,0,0);
    const deliveryDayAgo=new Date(now.getTime()-24*60*60_000);
    const [totalUsers,activeNow,active24h,totalPaths,totalLessons,recentUsers,registrations,deliveryCounts,retryBacklog,recentFailures]=await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({lastSeenAt:{$gte:activeNowSince}}),
      UserModel.countDocuments({lastSeenAt:{$gte:active24hSince}}),
      LearningPathModel.countDocuments(),
      LessonModel.countDocuments(),
      UserModel.find().sort({createdAt:-1}).limit(12).select('name email role createdAt lastSeenAt').lean(),
      UserModel.aggregate([{$match:{createdAt:{$gte:thirtyDaysAgo}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]),
      NotificationDeliveryModel.aggregate([
        {$match:{createdAt:{$gte:deliveryDayAgo}}},
        {$group:{_id:'$status',count:{$sum:1}}}
      ]),
      NotificationDeliveryModel.countDocuments({channel:'EMAIL',status:'FAILED',attemptCount:{$lt:3},nextAttemptAt:{$exists:true}}),
      NotificationDeliveryModel.find({status:'FAILED'}).sort({updatedAt:-1}).limit(8).select('eventType channel recipient attemptCount errorMessage lastAttemptAt nextAttemptAt updatedAt').lean()
    ]);
    const counts=new Map(registrations.map((r:{_id:string;count:number})=>[r._id,r.count]));
    const registrationTrend=Array.from({length:30},(_,i)=>{const d=new Date(thirtyDaysAgo);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);return {date,count:counts.get(date)??0};});
    const deliveryMap=new Map(deliveryCounts.map((r:{_id:string;count:number})=>[r._id,r.count]));
    const sent=deliveryMap.get('SENT')??0;const failed=deliveryMap.get('FAILED')??0;const pending=deliveryMap.get('PENDING')??0;const skipped=deliveryMap.get('SKIPPED')??0;
    const attempted=sent+failed;
    const deliveryRate=attempted?Math.round(sent/attempted*100):100;
    res.json({
      totalUsers,activeNow,active24h,totalPaths,totalLessons,registrationTrend,recentUsers,
      notificationHealth:{sent,failed,pending,skipped,retryBacklog,deliveryRate,recentFailures,windowHours:24}
    });
  }catch(error){next(error);}
}
