import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/ai-plan-job.model.js', () => ({ AiPlanJobModel: { deleteMany: vi.fn() } }));
vi.mock('./system-limit.service.js', () => ({
  getSystemLimit: vi.fn(),
  SYSTEM_LIMIT_KEYS: { AI_PLAN_PREVIEW_CLEANUP_DAYS: 'AI_PLAN_PREVIEW_CLEANUP_DAYS' }
}));

import { AiPlanCleanupWorkerService } from './ai-plan-cleanup-worker.service.js';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { getSystemLimit } from './system-limit.service.js';

describe('AiPlanCleanupWorkerService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes only unsaved, non-processing jobs older than the configured threshold', async () => {
    vi.mocked(getSystemLimit).mockResolvedValue(2);
    vi.mocked(AiPlanJobModel.deleteMany).mockResolvedValue({ deletedCount: 4 } as never);
    const worker = new AiPlanCleanupWorkerService();

    const result = await worker.runOnce();

    expect(getSystemLimit).toHaveBeenCalledWith('AI_PLAN_PREVIEW_CLEANUP_DAYS');
    expect(AiPlanJobModel.deleteMany).toHaveBeenCalledWith({
      learningPathId: { $exists: false },
      status: { $ne: 'PROCESSING' },
      updatedAt: { $lt: expect.any(Date) }
    });
    const query = vi.mocked(AiPlanJobModel.deleteMany).mock.calls[0]![0] as { updatedAt: { $lt: Date } };
    const cutoff = query.updatedAt.$lt;
    const expectedCutoff = Date.now() - 2 * 24 * 60 * 60_000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5_000);
    expect(result).toEqual({ deleted: 4 });
  });

  it('does not run two cleanup passes concurrently', async () => {
    vi.mocked(getSystemLimit).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(2), 20)));
    vi.mocked(AiPlanJobModel.deleteMany).mockResolvedValue({ deletedCount: 0 } as never);
    const worker = new AiPlanCleanupWorkerService();

    const [first, second] = await Promise.all([worker.runOnce(), worker.runOnce()]);

    expect(second).toEqual({ deleted: 0 });
    expect(getSystemLimit).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ deleted: 0 });
  });
});
