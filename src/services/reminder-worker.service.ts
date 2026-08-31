import { LessonModel } from '../models/lesson.model.js';
import { NotificationModel } from '../models/notification.model.js';

const MINUTE=60_000;
export class ReminderWorkerService {
  private timer?: NodeJS.Timeout;
  start(){ if(this.timer)return; this.timer=setInterval(()=>void this.tick(),MINUTE); void this.tick(); }
  stop(){ if(this.timer)clearInterval(this.timer); this.timer=undefined; }
  private async tick(){
    const now=new Date();
    const reminderCandidates=await LessonModel.find({status:'SCHEDULED',scheduledAt:{$exists:true},reminderSentAt:{$exists:false}}).limit(500);
    for(const lesson of reminderCandidates){const remindAt=new Date(lesson.scheduledAt!.getTime()-lesson.reminderMinutes*MINUTE);if(remindAt<=now){await NotificationModel.create({ownerId:lesson.ownerId,lessonId:lesson._id,type:'REMINDER',title:'Learning session soon',message:`${lesson.title} is scheduled for ${lesson.scheduledAt!.toISOString()}`});lesson.reminderSentAt=now;await lesson.save();}}
    const missed=await LessonModel.find({status:{$in:['SCHEDULED','IN_PROGRESS']},scheduledAt:{$lt:now}}).limit(500);
    for(const lesson of missed){const end=new Date(lesson.scheduledAt!.getTime()+lesson.durationMinutes*MINUTE);if(end<now){lesson.status='MISSED';lesson.missedAt=now;await lesson.save();await NotificationModel.create({ownerId:lesson.ownerId,lessonId:lesson._id,type:'MISSED',title:'Lesson missed',message:`${lesson.title} was not completed. Reschedule it from your learning board.`});}}
  }
}
export const reminderWorker=new ReminderWorkerService();
