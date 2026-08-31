import { env } from '../config/env.js';
import { LessonModel } from '../models/lesson.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';
import { brandedEmail } from './email-template.service.js';
import { emailService } from './email.service.js';

const MINUTE = 60_000;

function clientUrl(path: string): string {
  return `${env.CLIENT_ORIGIN.replace(/\/$/, '')}${path}`;
}

function formatScheduledAt(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone
  }).format(value);
}

export class ReminderWorkerService {
  private timer?: NodeJS.Timeout;
  start(): void { if (this.timer) return; this.timer = setInterval(() => void this.runOnce(), MINUTE); void this.runOnce(); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  async runOnce(): Promise<{ reminders: number; missed: number }> {
    const now = new Date(); let reminders = 0; let missedCount = 0;
    const reminderCandidates = await LessonModel.find({ status: 'SCHEDULED', scheduledAt: { $exists: true }, reminderSentAt: { $exists: false } }).limit(500);
    for (const lesson of reminderCandidates) {
      const user = await UserModel.findById(lesson.ownerId).select('name email timezone notificationPreferences').lean();
      if (!user) continue;
      const reminderMinutes = user.notificationPreferences?.reminderMinutes ?? lesson.reminderMinutes ?? 30;
      const remindAt = new Date(lesson.scheduledAt!.getTime() - reminderMinutes * MINUTE);
      if (remindAt > now) continue;

      const title = 'Your learning session is coming up';
      const message = `${lesson.title} is coming up soon. Open LearnFlow when you are ready to begin.`;
      if (user.notificationPreferences?.inAppReminders !== false) {
        await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'REMINDER', title, message });
      }

      if (user.email && user.notificationPreferences?.emailReminders !== false) {
        const scheduled = formatScheduledAt(lesson.scheduledAt!, user.timezone || 'UTC');
        const email = brandedEmail({
          preheader: `${lesson.title} is scheduled for ${scheduled}`,
          eyebrow: 'Upcoming learning session',
          title: 'Your next lesson is almost here',
          greeting: user.name,
          body: [
            'A quick reminder to protect the learning time you planned for yourself.',
            'When you are ready, open LearnFlow and continue from exactly where you left off.'
          ],
          detailRows: [
            { label: 'Lesson', value: lesson.title },
            { label: 'Scheduled', value: scheduled },
            { label: 'Duration', value: `${lesson.durationMinutes} minutes` },
            { label: 'Reminder', value: `${reminderMinutes} minutes before` }
          ],
          ctaLabel: 'Open learning board',
          ctaUrl: clientUrl('/board'),
          note: 'If your schedule has changed, you can reschedule the lesson from your LearnFlow board.'
        });
        await emailService.send({ to: user.email, subject: `Reminder: ${lesson.title}`, ...email });
      }
      lesson.reminderSentAt = now; await lesson.save(); reminders++;
    }

    const missed = await LessonModel.find({ status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { $lt: now } }).limit(500);
    for (const lesson of missed) {
      const end = new Date(lesson.scheduledAt!.getTime() + lesson.durationMinutes * MINUTE); if (end >= now) continue;
      lesson.status = 'MISSED'; lesson.missedAt = now; await lesson.save();
      const title = 'A learning session needs your attention';
      const message = `${lesson.title} was not completed. Open LearnFlow to reschedule it when it works for you.`;
      await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'MISSED', title, message });
      const user = await UserModel.findById(lesson.ownerId).select('name email timezone notificationPreferences').lean();
      if (user?.email && user.notificationPreferences?.missedSessionEmails !== false) {
        const scheduled = formatScheduledAt(lesson.scheduledAt!, user.timezone || 'UTC');
        const email = brandedEmail({
          preheader: `${lesson.title} was not completed as scheduled`,
          eyebrow: 'Keep your momentum',
          title: 'Your lesson is ready to be rescheduled',
          greeting: user.name,
          tone: 'warning',
          body: [
            'It looks like this learning session did not get completed at the time you planned.',
            'No need to lose the work you already organised. Pick a new time that works for you and keep the plan moving forward.'
          ],
          detailRows: [
            { label: 'Lesson', value: lesson.title },
            { label: 'Was scheduled', value: scheduled },
            { label: 'Duration', value: `${lesson.durationMinutes} minutes` }
          ],
          ctaLabel: 'Reschedule lesson',
          ctaUrl: clientUrl('/board'),
          note: 'Rescheduling keeps the lesson in your learning plan and helps your progress view stay accurate.'
        });
        await emailService.send({ to: user.email, subject: `Reschedule your LearnFlow lesson: ${lesson.title}`, ...email });
      }
      missedCount++;
    }
    return { reminders, missed: missedCount };
  }
}
export const reminderWorker = new ReminderWorkerService();
