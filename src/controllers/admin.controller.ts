import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';

export async function getAdminOverview(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const now=new Date();
    const activeNowSince=new Date(now.getTime()-5*60_000);
    const active24hSince=new Date(now.getTime()-24*60*60_000);
    const thirtyDaysAgo=new Date(now.getTime()-29*24*60*60_000);thirtyDaysAgo.setUTCHours(0,0,0,0);
    const [totalUsers,activeNow,active24h,totalPaths,totalLessons,recentUsers,registrations]=await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({lastSeenAt:{$gte:activeNowSince}}),
      UserModel.countDocuments({lastSeenAt:{$gte:active24hSince}}),
      LearningPathModel.countDocuments(),
      LessonModel.countDocuments(),
      UserModel.find().sort({createdAt:-1}).limit(12).select('name email role createdAt lastSeenAt').lean(),
      UserModel.aggregate([{$match:{createdAt:{$gte:thirtyDaysAgo}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}])
    ]);
    const counts=new Map(registrations.map((r:{_id:string;count:number})=>[r._id,r.count]));
    const registrationTrend=Array.from({length:30},(_,i)=>{const d=new Date(thirtyDaysAgo);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);return {date,count:counts.get(date)??0};});
    res.json({totalUsers,activeNow,active24h,totalPaths,totalLessons,registrationTrend,recentUsers});
  }catch(error){next(error);}
}
