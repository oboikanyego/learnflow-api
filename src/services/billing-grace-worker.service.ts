import { SubscriptionModel } from '../models/subscription.model.js';
import { expireGraceEntitlement } from './entitlement.service.js';

const MINUTE = 60_000;
const SWEEP_INTERVAL_MS = 5 * MINUTE;

export class BillingGraceWorkerService {
  private timer?: NodeJS.Timeout;
  private running = false;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), SWEEP_INTERVAL_MS);
    void this.runOnce();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<{ checked: number; expired: number }> {
    if (this.running) return { checked: 0, expired: 0 };
    this.running = true;
    try {
      const now = new Date();
      const candidates = await SubscriptionModel.find({
        status: 'PAST_DUE',
        graceEndsAt: { $lte: now },
        graceExpiredAt: { $exists: false }
      }).select('_id userId provider graceEndsAt').limit(500).lean();

      let expired = 0;
      for (const subscription of candidates) {
        if (!subscription.graceEndsAt) continue;
        const providerEventId = `grace-expiry:${String(subscription._id)}:${subscription.graceEndsAt.toISOString()}`;
        const result = await expireGraceEntitlement({
          userId: String(subscription.userId),
          provider: subscription.provider,
          providerEventId,
          reason: `Billing grace period expired at ${subscription.graceEndsAt.toISOString()}.`,
          now
        });

        if (!result.expired) continue;

        const update = await SubscriptionModel.updateOne(
          {
            _id: subscription._id,
            status: 'PAST_DUE',
            graceEndsAt: subscription.graceEndsAt,
            graceExpiredAt: { $exists: false }
          },
          { $set: { graceExpiredAt: now } }
        );
        if (update.modifiedCount === 1) expired++;
      }

      if (expired > 0) console.log(`Billing grace sweep expired ${expired} entitlement(s).`);
      return { checked: candidates.length, expired };
    } finally {
      this.running = false;
    }
  }
}

export const billingGraceWorker = new BillingGraceWorkerService();
