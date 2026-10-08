import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { getSystemLimit, SYSTEM_LIMIT_KEYS } from './system-limit.service.js';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

export class AiPlanCleanupWorkerService {
  private timer?: NodeJS.Timeout;
  private running = false;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), HOUR);
    void this.runOnce();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<{ deleted: number }> {
    if (this.running) return { deleted: 0 };
    this.running = true;
    try {
      const cleanupDays = await getSystemLimit(SYSTEM_LIMIT_KEYS.AI_PLAN_PREVIEW_CLEANUP_DAYS);
      const cutoff = new Date(Date.now() - cleanupDays * DAY);
      const result = await AiPlanJobModel.deleteMany({
        learningPathId: { $exists: false },
        status: { $ne: 'PROCESSING' },
        updatedAt: { $lt: cutoff }
      });
      return { deleted: result.deletedCount ?? 0 };
    } finally {
      this.running = false;
    }
  }
}

export const aiPlanCleanupWorker = new AiPlanCleanupWorkerService();
