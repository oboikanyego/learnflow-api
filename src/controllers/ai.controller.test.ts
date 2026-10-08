import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

vi.mock('../models/ai-plan-job.model.js', () => ({ AiPlanJobModel: { findOne: vi.fn(), deleteOne: vi.fn() } }));
vi.mock('../services/ai-plan-processor.service.js', () => ({
  generatedPlanSchema: z.any(),
  planRequestSchema: z.any(),
  createGeneratedPlan: vi.fn(),
  getUserTimezone: vi.fn(),
  persistGeneratedPlan: vi.fn()
}));
vi.mock('../services/ai-provider.service.js', () => ({ getAiProviderInfo: vi.fn(), generateAiText: vi.fn() }));
vi.mock('../services/ai-plan-queue.service.js', () => ({ enqueueAiPlanJob: vi.fn() }));
vi.mock('../services/ai-usage.service.js', () => ({ completeAiUsage: vi.fn(), getUserAiUsage: vi.fn(), reserveAiUsage: vi.fn() }));
vi.mock('../services/learning-intelligence.service.js', () => ({ coachContextFromIntelligence: vi.fn(), getLearningIntelligence: vi.fn(), buildReplanProposal: vi.fn() }));

import { coach, deletePlanJob, savePlanJob } from './ai.controller.js';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { getUserTimezone, persistGeneratedPlan } from '../services/ai-plan-processor.service.js';
import { getAiProviderInfo, generateAiText } from '../services/ai-provider.service.js';
import { completeAiUsage, getUserAiUsage, reserveAiUsage } from '../services/ai-usage.service.js';
import { buildReplanProposal, getLearningIntelligence } from '../services/learning-intelligence.service.js';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { user: { id: 'user-1', role: 'learner' }, params: { id: 'job-1' }, body: {}, ...overrides } as AuthenticatedRequest;
}

const samplePlan = { learningPath: { title: 'Learn React' }, phases: [] };

describe('savePlanJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the job does not exist for this owner', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue(null as never);
    const res = mockRes();
    const next = vi.fn();

    await savePlanJob(mockReq(), res, next);

    expect(AiPlanJobModel.findOne).toHaveBeenCalledWith({ _id: 'job-1', ownerId: 'user-1' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(persistGeneratedPlan).not.toHaveBeenCalled();
  });

  it('returns 409 when the job has not completed yet', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({ status: 'PROCESSING', plan: undefined } as never);
    const res = mockRes();
    const next = vi.fn();

    await savePlanJob(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'This learning plan is not ready to be saved yet.' });
  });

  it('returns 409 when the plan has already been saved', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({
      status: 'COMPLETED', plan: samplePlan, learningPathId: 'existing-path'
    } as never);
    const res = mockRes();
    const next = vi.fn();

    await savePlanJob(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'This learning plan has already been saved.' });
    expect(persistGeneratedPlan).not.toHaveBeenCalled();
  });

  it('persists the previewed plan and marks the job saved', async () => {
    const job = {
      status: 'COMPLETED',
      plan: samplePlan,
      learningPathId: undefined as string | undefined,
      input: { save: false },
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue({ _id: 'job-1', status: 'COMPLETED' })
    };
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue(job as never);
    vi.mocked(getUserTimezone).mockResolvedValue('Africa/Johannesburg');
    vi.mocked(persistGeneratedPlan).mockResolvedValue({ learningPathId: 'new-path-id', learningPathIdString: 'new-path-id', lessonCount: 5 } as never);
    const res = mockRes();
    const next = vi.fn();

    await savePlanJob(mockReq(), res, next);

    expect(getUserTimezone).toHaveBeenCalledWith('user-1');
    expect(persistGeneratedPlan).toHaveBeenCalledWith('user-1', 'Africa/Johannesburg', samplePlan);
    expect(job.learningPathId).toBe('new-path-id');
    expect(job.input.save).toBe(true);
    expect(job.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ learningPathId: 'new-path-id', lessonCount: 5, job: { _id: 'job-1', status: 'COMPLETED' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('saves learner-edited plan content instead of the original when provided', async () => {
    const editedPlan = { learningPath: { title: 'Learn React (edited)' }, phases: [] };
    const job = {
      status: 'COMPLETED',
      plan: samplePlan,
      learningPathId: undefined as string | undefined,
      input: { save: false },
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue({})
    };
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue(job as never);
    vi.mocked(getUserTimezone).mockResolvedValue('UTC');
    vi.mocked(persistGeneratedPlan).mockResolvedValue({ learningPathId: 'new-path-id', learningPathIdString: 'new-path-id', lessonCount: 1 } as never);
    const res = mockRes();
    const next = vi.fn();

    await savePlanJob(mockReq({ body: { plan: editedPlan } }), res, next);

    expect(persistGeneratedPlan).toHaveBeenCalledWith('user-1', 'UTC', editedPlan);
    expect(job.plan).toEqual(editedPlan);
  });
});

describe('deletePlanJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the job does not exist for this owner', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue(null as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePlanJob(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(AiPlanJobModel.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses to delete a plan that has already been saved', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({ _id: 'job-1', status: 'COMPLETED', learningPathId: 'existing-path' } as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePlanJob(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(AiPlanJobModel.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses to delete a plan that is still generating', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({ _id: 'job-1', status: 'PROCESSING', learningPathId: undefined } as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePlanJob(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(AiPlanJobModel.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes an unsaved, completed preview job', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({ _id: 'job-1', status: 'COMPLETED', learningPathId: undefined } as never);
    vi.mocked(AiPlanJobModel.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePlanJob(mockReq(), res, next);

    expect(AiPlanJobModel.deleteOne).toHaveBeenCalledWith({ _id: 'job-1' });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('deletes an unsaved, failed job', async () => {
    vi.mocked(AiPlanJobModel.findOne).mockResolvedValue({ _id: 'job-2', status: 'FAILED', learningPathId: undefined } as never);
    vi.mocked(AiPlanJobModel.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);
    const res = mockRes();
    const next = vi.fn();

    await deletePlanJob(mockReq({ params: { id: 'job-2' } }), res, next);

    expect(AiPlanJobModel.deleteOne).toHaveBeenCalledWith({ _id: 'job-2' });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('coach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAiProviderInfo).mockReturnValue({ configured: true, provider: 'openai', model: 'gpt-4o-mini' } as never);
    vi.mocked(reserveAiUsage).mockResolvedValue({ id: 'usage-1' } as never);
    vi.mocked(getUserAiUsage).mockResolvedValue({} as never);
    vi.mocked(generateAiText).mockResolvedValue('Here is some coaching advice.');
    vi.mocked(completeAiUsage).mockResolvedValue(undefined as never);
  });

  function reqWithMessage(message = 'How am I doing this week?'): AuthenticatedRequest {
    return mockReq({ body: { message } });
  }

  it('returns 503 when no AI provider is configured', async () => {
    vi.mocked(getAiProviderInfo).mockReturnValue({ configured: false, provider: 'openai', model: '' } as never);
    const res = mockRes();
    const next = vi.fn();

    await coach(reqWithMessage(), res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(generateAiText).not.toHaveBeenCalled();
  });

  it('does not attach a reschedule proposal when the learner has no missed lessons', async () => {
    vi.mocked(getLearningIntelligence).mockResolvedValue({ missedLessons: 0 } as never);
    const res = mockRes();
    const next = vi.fn();

    await coach(reqWithMessage(), res, next);

    expect(buildReplanProposal).not.toHaveBeenCalled();
    const [payload] = vi.mocked(res.json).mock.calls[0]!;
    expect(payload).toMatchObject({ answer: 'Here is some coaching advice.', proposedReplan: undefined });
  });

  it('attaches a data-grounded reschedule proposal when the learner has missed lessons', async () => {
    vi.mocked(getLearningIntelligence).mockResolvedValue({ missedLessons: 2 } as never);
    const replan = { behindMinutes: 90, changes: [{ lessonId: 'l1', title: 'Intro', proposedScheduledAt: '2024-06-11T18:00:00.000Z', durationMinutes: 45 }] };
    vi.mocked(buildReplanProposal).mockResolvedValue(replan as never);
    const res = mockRes();
    const next = vi.fn();

    await coach(reqWithMessage(), res, next);

    expect(buildReplanProposal).toHaveBeenCalledWith('user-1');
    const [payload] = vi.mocked(res.json).mock.calls[0]!;
    expect(payload).toMatchObject({ proposedReplan: replan });
  });

  it('omits the proposal when missed lessons are reported but the replan has no changes', async () => {
    vi.mocked(getLearningIntelligence).mockResolvedValue({ missedLessons: 1 } as never);
    vi.mocked(buildReplanProposal).mockResolvedValue({ behindMinutes: 0, changes: [] } as never);
    const res = mockRes();
    const next = vi.fn();

    await coach(reqWithMessage(), res, next);

    const [payload] = vi.mocked(res.json).mock.calls[0]!;
    expect(payload).toMatchObject({ proposedReplan: undefined });
  });

  it('marks AI usage failed and forwards the error when generation throws', async () => {
    vi.mocked(getLearningIntelligence).mockResolvedValue({ missedLessons: 0 } as never);
    const error = new Error('provider timeout');
    vi.mocked(generateAiText).mockRejectedValue(error);
    const res = mockRes();
    const next = vi.fn();

    await coach(reqWithMessage(), res, next);

    expect(completeAiUsage).toHaveBeenCalledWith('usage-1', 'FAILED', { errorMessage: 'provider timeout' });
    expect(next).toHaveBeenCalledWith(error);
  });
});
