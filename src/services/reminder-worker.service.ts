import { env } from '../config/env.js';
import { LessonModel, type LessonDocument } from '../models/lesson.model.js';
import { NotificationDeliveryModel, type DeliveryChannel } from '../models/notification-delivery.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';
import { brandedEmail } from './email-template.service.js';
import { emailService } from './email.service.js';
import { invalidateLearningCache } from './redis.service.js';

const MINUTE = 60_000;
const MAX_EMAIL_ATTEMPTS = 3;
const RETRY_DELAYS_MINUTES = [5, 15, 60];

function clientUrl(path: string): string {
  return `${env.CLIENT_ORIGIN.replace(/\/$/, '')}${path}`;
}

function formatScheduledAt(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone
  }).format(value);
}

function eventKey(eventType: 'REMINDER' | 'MISSED', lessonId: unknown, scheduledAt: Date): string {
  return `${eventType}:${String(lessonId)}:${scheduledAt.toISOString()}`;
}

function nextRetryAt(attemptCount: number): Date | undefined {
  if (attemptCount >= MAX_EMAIL_ATTEMPTS) return undefined;
  const delay = RETRY_DELAYS_MINUTES[Math.min(attemptCount - 1, RETRY_DELAYS_MINUTES.length - 1)] ?? 60;
  return new Date(Date.now() + delay * MINUTE);
}

async function ensureDelivery(input: {
  ownerId: unknown;
  lessonId: unknown;
  eventKey: string;
  eventType: 'REMINDER' | 'MISSED';
  channel: DeliveryChannel;
  recipient?: string;
}) {
  return NotificationDeliveryModel.findOneAndUpdate(
    { eventKey: input.eventKey, channel: input.channel },
    {
      $setOnInsert: {
        ownerId: input.ownerId,
        lessonId: input.lessonId,
        eventKey: input.eventKey,
        eventType: input.eventType,
        channel: input.channel,
        recipient: input.recipient,
        status: 'PENDING',
        attemptCount: 0
      }
    },
    { upsert: true, new: true }
  );
}

export class ReminderWorkerService {
  private timer?: NodeJS.Timeout;
  private running = false;

  start(): void { if (this.timer) return; this.timer = setInterval(() => void this.runOnce(), MINUTE); void this.runOnce(); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  async runOnce(): Promise<{ reminders: number; missed: number; retried: number }> {
    if (this.running) return { reminders: 0, missed: 0, retried: 0 };
    this.running = true;
    try {
      const retried = await this.retryFailedEmails();
      const now = new Date(); let reminders = 0; let missedCount = 0;

      const reminderCandidates = await LessonModel.find({ status: 'SCHEDULED', scheduledAt: { $exists: true }, reminderSentAt: { $exists: false } }).limit(500);
      for (const lesson of reminderCandidates) {
        const user = await UserModel.findById(lesson.ownerId).select('name email timezone notificationPreferences').lean();
        if (!user) continue;
        const reminderMinutes = user.notificationPreferences?.reminderMinutes ?? lesson.reminderMinutes ?? 30;
        const remindAt = new Date(lesson.scheduledAt!.getTime() - reminderMinutes * MINUTE);
        if (remindAt > now) continue;

        const key = eventKey('REMINDER', lesson._id, lesson.scheduledAt!);
        const title = 'Your learning session is coming up';
        const message = `${lesson.title} is coming up soon. Open LearnFlow when you are ready to begin.`;

        if (user.notificationPreferences?.inAppReminders !== false) {
          const delivery = await ensureDelivery({ ownerId: lesson.ownerId, lessonId: lesson._id, eventKey: key, eventType: 'REMINDER', channel: 'IN_APP' });
          if (delivery.status !== 'SENT') {
            await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'REMINDER', title, message });
            await NotificationDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: 'SENT', sentAt: now, lastAttemptAt: now }, $inc: { attemptCount: 1 } });
          }
        } else {
          await this.markSkipped(lesson, key, 'REMINDER', 'IN_APP', 'In-app reminders disabled');
        }

        let emailHandled = true;
        if (user.email && user.notificationPreferences?.emailReminders !== false) {
          emailHandled = await this.sendReminderEmail(lesson, user, key, reminderMinutes);
        } else {
          await this.markSkipped(lesson, key, 'REMINDER', 'EMAIL', user.email ? 'Email reminders disabled' : 'No email address available');
        }

        if (emailHandled) {
          lesson.reminderSentAt = now;
          await lesson.save();
          reminders++;
        }
      }

      const missed = await LessonModel.find({ status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { $lt: now } }).limit(500);
      for (const lesson of missed) {
        const end = new Date(lesson.scheduledAt!.getTime() + lesson.durationMinutes * MINUTE);
        if (end >= now) continue;

        lesson.status = 'MISSED'; lesson.missedAt = now; await lesson.save();
        await invalidateLearningCache(String(lesson.ownerId), { learningPathId: String(lesson.learningPathId), lessonId: String(lesson._id), invalidatePathList: false });
        const key = eventKey('MISSED', lesson._id, lesson.scheduledAt!);
        const title = 'A learning session needs your attention';
        const message = `${lesson.title} was not completed. Open LearnFlow to reschedule it when it works for you.`;

        const inAppDelivery = await ensureDelivery({ ownerId: lesson.ownerId, lessonId: lesson._id, eventKey: key, eventType: 'MISSED', channel: 'IN_APP' });
        if (inAppDelivery.status !== 'SENT') {
          await NotificationModel.create({ ownerId: lesson.ownerId, lessonId: lesson._id, type: 'MISSED', title, message });
          await NotificationDeliveryModel.updateOne({ _id: inAppDelivery._id }, { $set: { status: 'SENT', sentAt: now, lastAttemptAt: now }, $inc: { attemptCount: 1 } });
        }

        const user = await UserModel.findById(lesson.ownerId).select('name email timezone notificationPreferences').lean();
        if (user?.email && user.notificationPreferences?.missedSessionEmails !== false) {
          await this.sendMissedEmail(lesson, user, key);
        } else {
          await this.markSkipped(lesson, key, 'MISSED', 'EMAIL', user?.email ? 'Missed-session emails disabled' : 'No email address available');
        }
        missedCount++;
      }
      return { reminders, missed: missedCount, retried };
    } finally {
      this.running = false;
    }
  }

  private async sendReminderEmail(lesson: LessonDocument & { _id: unknown }, user: { name: string; email: string; timezone?: string }, key: string, reminderMinutes: number): Promise<boolean> {
    const delivery = await ensureDelivery({ ownerId: lesson.ownerId, lessonId: lesson._id, eventKey: key, eventType: 'REMINDER', channel: 'EMAIL', recipient: user.email });
    if (delivery.status === 'SENT' || delivery.status === 'SKIPPED') return true;
    if (delivery.attemptCount >= MAX_EMAIL_ATTEMPTS && delivery.status === 'FAILED') return true;

    const scheduled = formatScheduledAt(lesson.scheduledAt!, user.timezone || 'UTC');
    const email = brandedEmail({
      preheader: `${lesson.title} is scheduled for ${scheduled}`,
      eyebrow: 'Upcoming learning session',
      title: 'Your next lesson is almost here',
      greeting: user.name,
      body: ['A quick reminder to protect the learning time you planned for yourself.', 'When you are ready, open LearnFlow and continue from exactly where you left off.'],
      detailRows: [
        { label: 'Lesson', value: lesson.title }, { label: 'Scheduled', value: scheduled },
        { label: 'Duration', value: `${lesson.durationMinutes} minutes` }, { label: 'Reminder', value: `${reminderMinutes} minutes before` }
      ],
      ctaLabel: 'Open learning board', ctaUrl: clientUrl('/board'),
      note: 'If your schedule has changed, you can reschedule the lesson from your LearnFlow board.'
    });
    return this.attemptEmail(delivery._id, user.email, `Reminder: ${lesson.title}`, email);
  }

  private async sendMissedEmail(lesson: LessonDocument & { _id: unknown }, user: { name: string; email: string; timezone?: string }, key: string): Promise<boolean> {
    const delivery = await ensureDelivery({ ownerId: lesson.ownerId, lessonId: lesson._id, eventKey: key, eventType: 'MISSED', channel: 'EMAIL', recipient: user.email });
    if (delivery.status === 'SENT' || delivery.status === 'SKIPPED') return true;
    if (delivery.attemptCount >= MAX_EMAIL_ATTEMPTS && delivery.status === 'FAILED') return true;

    const scheduled = formatScheduledAt(lesson.scheduledAt!, user.timezone || 'UTC');
    const email = brandedEmail({
      preheader: `${lesson.title} was not completed as scheduled`, eyebrow: 'Keep your momentum',
      title: 'Your lesson is ready to be rescheduled', greeting: user.name, tone: 'warning',
      body: ['It looks like this learning session did not get completed at the time you planned.', 'No need to lose the work you already organised. Pick a new time that works for you and keep the plan moving forward.'],
      detailRows: [{ label: 'Lesson', value: lesson.title }, { label: 'Was scheduled', value: scheduled }, { label: 'Duration', value: `${lesson.durationMinutes} minutes` }],
      ctaLabel: 'Reschedule lesson', ctaUrl: clientUrl('/board'),
      note: 'Rescheduling keeps the lesson in your learning plan and helps your progress view stay accurate.'
    });
    return this.attemptEmail(delivery._id, user.email, `Reschedule your LearnFlow lesson: ${lesson.title}`, email);
  }

  private async attemptEmail(deliveryId: unknown, to: string, subject: string, email: { text: string; html: string }): Promise<boolean> {
    const now = new Date();
    const current = await NotificationDeliveryModel.findById(deliveryId);
    if (!current) return false;
    const attemptCount = current.attemptCount + 1;
    const result = await emailService.send({ to, subject, ...email });

    if (result.status === 'SENT') {
      await NotificationDeliveryModel.updateOne({ _id: deliveryId }, { $set: { status: 'SENT', provider: result.provider, providerMessageId: result.providerMessageId, sentAt: now, lastAttemptAt: now, nextAttemptAt: undefined, errorMessage: undefined, attemptCount } });
      return true;
    }
    if (result.status === 'SKIPPED') {
      await NotificationDeliveryModel.updateOne({ _id: deliveryId }, { $set: { status: 'SKIPPED', provider: result.provider, lastAttemptAt: now, nextAttemptAt: undefined, errorMessage: result.errorMessage, attemptCount } });
      return true;
    }

    const nextAttemptAt = nextRetryAt(attemptCount);
    await NotificationDeliveryModel.updateOne({ _id: deliveryId }, { $set: { status: 'FAILED', provider: result.provider, lastAttemptAt: now, nextAttemptAt, errorMessage: result.errorMessage, attemptCount } });
    return !nextAttemptAt;
  }

  private async retryFailedEmails(): Promise<number> {
    const now = new Date();
    const failed = await NotificationDeliveryModel.find({ channel: 'EMAIL', status: 'FAILED', attemptCount: { $lt: MAX_EMAIL_ATTEMPTS }, nextAttemptAt: { $lte: now } }).sort({ nextAttemptAt: 1 }).limit(100);
    let retried = 0;
    for (const delivery of failed) {
      const lesson = delivery.lessonId ? await LessonModel.findById(delivery.lessonId) : null;
      if (!lesson?.scheduledAt) continue;
      const user = await UserModel.findById(delivery.ownerId).select('name email timezone notificationPreferences').lean();
      if (!user?.email) {
        await NotificationDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: 'SKIPPED', nextAttemptAt: undefined, errorMessage: 'No email address available' } });
        continue;
      }
      if (delivery.eventType === 'REMINDER') {
        const reminderMinutes = user.notificationPreferences?.reminderMinutes ?? lesson.reminderMinutes ?? 30;
        await this.sendReminderEmail(lesson, user, delivery.eventKey, reminderMinutes);
      } else {
        await this.sendMissedEmail(lesson, user, delivery.eventKey);
      }
      retried++;
    }
    return retried;
  }

  private async markSkipped(lesson: LessonDocument & { _id: unknown }, key: string, eventType: 'REMINDER' | 'MISSED', channel: DeliveryChannel, reason: string): Promise<void> {
    const delivery = await ensureDelivery({ ownerId: lesson.ownerId, lessonId: lesson._id, eventKey: key, eventType, channel });
    if (delivery.status === 'PENDING') {
      await NotificationDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: 'SKIPPED', errorMessage: reason, lastAttemptAt: new Date() } });
    }
  }
}
export const reminderWorker = new ReminderWorkerService();
