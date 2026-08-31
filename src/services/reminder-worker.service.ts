import { LessonModel } from '../models/lesson.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';
import { emailService } from './email.service.js';

const MINUTE = 60_000;
export class ReminderWorkerService {
  private timer?: NodeJS.Timeout;
  start(): void { if (this.timer) return; this.timer = setInterval(() => void this.runOnce(), MINUTE); void this.runOnce(); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  async runOnce(): Promise<{ reminders: number; missed: number }> {
    const now = new Date(); let reminders = 0; let missedCount = 0;
    const reminderCandidates = await LessonModel.find({ status: 'SCHEDULED', scheduledAt: { $exists: true }, reminderSentAt: { $exists: false } }).limit(500);
    for (const lesson of reminderCandidates) {
      const remindAt = new Date(lesson.scheduledAt!.getTime() - lesson.reminderMinutes * MINUTE);
      if (remindAt > now) continue;
      const title = 'Learning session soon'; const message = `${lesson.title} is scheduled for ${lesson.scheduledAt!.toISOString()}`;
      await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'REMINDER', title, message });
      const user = await UserModel.findById(lesson.ownerId).select('email').lean(); if (user?.email) await emailService.send(user.email, title, message);
      lesson.reminderSentAt = now; await lesson.save(); reminders++;
    }
    const missed = await LessonModel.find({ status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { $lt: now } }).limit(500);
    for (const lesson of missed) {
      const end = new Date(lesson.scheduledAt!.getTime() + lesson.durationMinutes * MINUTE); if (end >= now) continue;
      lesson.status = 'MISSED'; lesson.missedAt = now; await lesson.save();
      const title = 'Lesson missed'; const message = `${lesson.title} was not completed. Open LearnFlow to reschedule it.`;
      await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'MISSED', title, message });
      const user = await UserModel.findById(lesson.ownerId).select('email').lean(); if (user?.email) await emailService.send(user.email, title, message);
      missedCount++;
    }
    return { reminders, missed: missedCount };
  }
}
export const reminderWorker = new ReminderWorkerService();
