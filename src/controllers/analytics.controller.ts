import type { Response,NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { LessonModel } from '../models/lesson.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { StudySessionModel } from '../models/study-session.model.js';

function weekKey(date: Date): string {
  const value=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=(value.getUTCDay()+6)%7;
  value.setUTCDate(value.getUTCDate()-day);
  return value.toISOString().slice(0,10);
}

export async function getAnalytics(req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const ownerId=req.user!.id;
    const now=new Date();
    const currentWeek=new Date(now);currentWeek.setUTCHours(0,0,0,0);currentWeek.setUTCDate(currentWeek.getUTCDate()-((currentWeek.getUTCDay()+6)%7));
    const [paths,total,completed,missed,scheduled,lessons,nextLessons,sessions]=await Promise.all([
      LearningPathModel.countDocuments({ownerId}),
      LessonModel.countDocuments({ownerId}),
      LessonModel.countDocuments({ownerId,status:'COMPLETED'}),
      LessonModel.countDocuments({ownerId,status:'MISSED'}),
      LessonModel.countDocuments({ownerId,status:'SCHEDULED'}),
      LessonModel.find({ownerId}).select('status durationMinutes completedAt scheduledAt').lean(),
      LessonModel.find({ownerId,status:'SCHEDULED',scheduledAt:{$gte:now}}).sort({scheduledAt:1}).limit(4).select('title scheduledAt durationMinutes').lean(),
      StudySessionModel.find({ownerId,status:'COMPLETED'}).select('elapsedSeconds endedAt startedAt').lean()
    ]);
    const completedMinutes=lessons.filter(l=>l.status==='COMPLETED').reduce((s,l)=>s+(l.durationMinutes||0),0);
    const trackedSeconds=sessions.reduce((sum,item)=>sum+(item.elapsedSeconds||0),0);
    const focusSecondsThisWeek=sessions.filter(item=>new Date(item.endedAt??item.startedAt)>=currentWeek).reduce((sum,item)=>sum+(item.elapsedSeconds||0),0);
    const dates=[...new Set(lessons.filter(l=>l.completedAt).map(l=>new Date(l.completedAt!).toISOString().slice(0,10)))].sort().reverse();
    let streak=0;const cursor=new Date();cursor.setUTCHours(0,0,0,0);for(const day of dates){const expected=cursor.toISOString().slice(0,10);if(day===expected){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}else if(streak===0){cursor.setUTCDate(cursor.getUTCDate()-1);if(day===cursor.toISOString().slice(0,10)){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}else break;}else break;}

    const statuses=['BACKLOG','SCHEDULED','IN_PROGRESS','COMPLETED','MISSED','SKIPPED'] as const;
    const statusBreakdown=statuses.map(status=>({status,count:lessons.filter(l=>l.status===status).length}));
    const weeklyCompletions=Array.from({length:8},(_,index)=>{
      const start=new Date(currentWeek);start.setUTCDate(start.getUTCDate()-(7*(7-index)));
      const key=start.toISOString().slice(0,10);
      return {weekStart:key,label:start.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',timeZone:'UTC'}),completed:0,hours:0};
    });
    const byWeek=new Map(weeklyCompletions.map(item=>[item.weekStart,item]));
    for(const lesson of lessons){if(!lesson.completedAt)continue;const bucket=byWeek.get(weekKey(new Date(lesson.completedAt)));if(bucket){bucket.completed++;bucket.hours=Number((bucket.hours+(lesson.durationMinutes||0)/60).toFixed(1));}}

    res.json({
      learningPaths:paths,totalLessons:total,completedLessons:completed,missedLessons:missed,scheduledLessons:scheduled,
      completionRate:total?Math.round(completed/total*100):0,completedHours:Number((completedMinutes/60).toFixed(1)),currentStreakDays:streak,
      trackedStudyHours:Number((trackedSeconds/3600).toFixed(1)),focusMinutesThisWeek:Math.round(focusSecondsThisWeek/60),sessionsCompleted:sessions.length,
      statusBreakdown,weeklyCompletions,
      nextLessons:nextLessons.map(item=>({_id:String(item._id),title:item.title,scheduledAt:item.scheduledAt?.toISOString(),durationMinutes:item.durationMinutes}))
    });
  }catch(e){next(e);}
}
