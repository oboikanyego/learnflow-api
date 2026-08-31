import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';

export async function getAnalytics(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;
    const [paths,total,completed,missed,scheduled,lessons]=await Promise.all([
      LearningPathModel.countDocuments({ownerId}),LessonModel.countDocuments({ownerId}),LessonModel.countDocuments({ownerId,status:'COMPLETED'}),LessonModel.countDocuments({ownerId,status:'MISSED'}),LessonModel.countDocuments({ownerId,status:'SCHEDULED'}),LessonModel.find({ownerId}).select('status durationMinutes completedAt').lean()
    ]);
    const completedMinutes=lessons.filter(l=>l.status==='COMPLETED').reduce((s,l)=>s+(l.durationMinutes||0),0);
    const dates=[...new Set(lessons.filter(l=>l.completedAt).map(l=>new Date(l.completedAt!).toISOString().slice(0,10)))].sort().reverse();
    let streak=0;const cursor=new Date();cursor.setUTCHours(0,0,0,0);for(const day of dates){const expected=cursor.toISOString().slice(0,10);if(day===expected){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}else if(streak===0){cursor.setUTCDate(cursor.getUTCDate()-1);if(day===cursor.toISOString().slice(0,10)){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}else break;}else break;}
    res.json({learningPaths:paths,totalLessons:total,completedLessons:completed,missedLessons:missed,scheduledLessons:scheduled,completionRate:total?Math.round(completed/total*100):0,completedHours:Number((completedMinutes/60).toFixed(1)),currentStreakDays:streak});
  }catch(e){next(e);}
}
