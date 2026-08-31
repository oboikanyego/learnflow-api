import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { WeeklyReviewDeliveryModel } from '../models/weekly-review-delivery.model.js';
import { entitlementCapabilities } from './entitlement.service.js';
import { brandedEmail } from './email-template.service.js';
import { emailService } from './email.service.js';
import { getLearningIntelligence } from './learning-intelligence.service.js';

const HOUR = 60 * 60_000;

function currentWeekStart(value = new Date()): string {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function clientUrl(path: string) { return `${env.CLIENT_ORIGIN.replace(/\/$/, '')}${path}`; }

export class WeeklyReviewWorkerService {
  private timer?: NodeJS.Timeout;
  private running = false;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), HOUR);
    void this.runOnce();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (this.running) return { sent: 0, failed: 0, skipped: 0 };
    this.running = true;
    try {
      const now = new Date();
      if (now.getUTCDay() !== 1 || now.getUTCHours() < 6) return { sent: 0, failed: 0, skipped: 0 };
      const weekStart = currentWeekStart(now);
      const users = await UserModel.find({ 'notificationPreferences.weeklyReviewEmails': true }).select('name email entitlement notificationPreferences').lean();
      let sent = 0; let failed = 0; let skipped = 0;
      for (const user of users) {
        const already = await WeeklyReviewDeliveryModel.exists({ ownerId: user._id, weekStart });
        if (already) continue;
        const capabilities = entitlementCapabilities(user.entitlement);
        if (!capabilities.weeklyProgressEmail) {
          await WeeklyReviewDeliveryModel.create({ ownerId: user._id, weekStart, status: 'SKIPPED', errorMessage: 'Weekly progress email requires an active Pro entitlement.' });
          skipped++;
          continue;
        }
        const intelligence = await getLearningIntelligence(String(user._id));
        const email = brandedEmail({
          preheader: `Your LearnFlow week: ${intelligence.week.completed} completed, ${intelligence.week.missed} missed`,
          eyebrow: 'Weekly learning review',
          title: 'Your learning week at a glance',
          greeting: user.name,
          body: [
            `You completed ${intelligence.week.completed} lesson${intelligence.week.completed === 1 ? '' : 's'} and studied ${Math.round(intelligence.week.studiedMinutes / 60 * 10) / 10} hours this week.`,
            intelligence.weakestModules.length ? `Your clearest opportunity next week is ${intelligence.weakestModules[0].title}.` : 'Your learning plan is staying on track. Keep protecting the sessions you schedule.'
          ],
          detailRows: [
            { label: 'Completion rate', value: `${intelligence.week.completionRate}%` },
            { label: 'Current streak', value: `${intelligence.consistency.currentStreakDays} days` },
            { label: 'Weekly target', value: intelligence.week.weeklyTargetMinutes ? `${intelligence.week.targetProgress}% reached` : 'No target set' },
            { label: 'Missed lessons', value: String(intelligence.week.missed) }
          ],
          ctaLabel: 'Review progress',
          ctaUrl: clientUrl('/progress'),
          note: intelligence.missedLessons ? 'LearnFlow can build a proposed rebalanced schedule for missed lessons from your Progress workspace.' : 'You can update your weekly learning goal any time from your Progress workspace.'
        });
        const result = await emailService.send({ to: user.email, subject: 'Your LearnFlow weekly review', ...email });
        if (result.status === 'SENT') {
          await WeeklyReviewDeliveryModel.create({ ownerId: user._id, weekStart, status: 'SENT', provider: result.provider, providerMessageId: result.providerMessageId, sentAt: new Date() });
          sent++;
        } else if (result.status === 'SKIPPED') {
          await WeeklyReviewDeliveryModel.create({ ownerId: user._id, weekStart, status: 'SKIPPED', provider: result.provider, errorMessage: result.errorMessage });
          skipped++;
        } else {
          await WeeklyReviewDeliveryModel.create({ ownerId: user._id, weekStart, status: 'FAILED', provider: result.provider, errorMessage: result.errorMessage });
          failed++;
        }
      }
      return { sent, failed, skipped };
    } finally {
      this.running = false;
    }
  }
}

export const weeklyReviewWorker = new WeeklyReviewWorkerService();
