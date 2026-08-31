import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { getAiProviderInfo, generateAiText } from '../services/ai-provider.service.js';
import { createGeneratedPlan, getUserTimezone, persistGeneratedPlan, planRequestSchema } from '../services/ai-plan-processor.service.js';
import { enqueueAiPlanJob } from '../services/ai-plan-queue.service.js';
import { completeAiUsage, getUserAiUsage, reserveAiUsage } from '../services/ai-usage.service.js';

const coachSchema = z.object({ message: z.string().min(2).max(4000), context: z.string().max(4000).optional() });

export async function generatePlan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const input = planRequestSchema.parse(req.body);
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.` });
    const usage = await reserveAiUsage(req.user!.id, req.user!.role, 'PLAN', { mode: 'synchronous', save: input.save });
    usageId = usage.id;
    const timezone = await getUserTimezone(req.user!.id);
    const parsed = await createGeneratedPlan(input, timezone);
    const learningPathId = input.save ? await persistGeneratedPlan(req.user!.id, timezone, parsed) : undefined;
    await completeAiUsage(usage.id, 'SUCCEEDED');
    res.json({ plan: parsed, learningPathId, timezone, provider: provider.provider, model: provider.model, usage: await getUserAiUsage(req.user!.id) });
  } catch (error) {
    if (usageId) await completeAiUsage(usageId, 'FAILED', { errorMessage: error instanceof Error ? error.message : 'AI generation failed' }).catch(() => undefined);
    next(error);
  }
}

export async function queuePlan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const input = planRequestSchema.parse(req.body);
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.` });
    const usage = await reserveAiUsage(req.user!.id, req.user!.role, 'PLAN', { mode: 'background', save: input.save });
    usageId = usage.id;
    const timezone = await getUserTimezone(req.user!.id);
    const job = await AiPlanJobModel.create({ ownerId: req.user!.id, status: 'QUEUED', input });
    try {
      await enqueueAiPlanJob({ appJobId: job.id, ownerId: req.user!.id, timezone, input, usageId: usage.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background queue unavailable';
      await AiPlanJobModel.findByIdAndUpdate(job._id, { status: 'FAILED', errorMessage: message.slice(0, 500), completedAt: new Date() });
      await completeAiUsage(usage.id, 'FAILED', { jobId: job.id, errorMessage: message });
      throw error;
    }
    res.status(202).json({ jobId: job.id, status: job.status, usage: await getUserAiUsage(req.user!.id), message: 'Your learning plan is safely queued in the background. You can continue using LearnFlow and we will notify you when it is ready.' });
  } catch (error) {
    if (usageId && !(error instanceof Error && error.message.includes('Background queue unavailable'))) {
      // Queue failures are completed above; other post-reservation failures are accounted for here.
    }
    next(error);
  }
}

export async function retryPlanJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI plan generation is not configured for ${provider.provider}. Configure an AI provider key on Render.` });
    const source = await AiPlanJobModel.findOne({ _id: req.params.id, ownerId: req.user!.id }).lean();
    if (!source) return res.status(404).json({ message: 'Learning plan job not found' });
    if (source.status !== 'FAILED') return res.status(409).json({ message: 'Only failed learning plan requests can be retried.' });
    const input = planRequestSchema.parse(source.input);
    const usage = await reserveAiUsage(req.user!.id, req.user!.role, 'PLAN', { mode: 'manual-retry', retryOf: String(source._id), save: input.save });
    usageId = usage.id;
    const timezone = await getUserTimezone(req.user!.id);
    const retry = await AiPlanJobModel.create({ ownerId: req.user!.id, status: 'QUEUED', input });
    try {
      await enqueueAiPlanJob({ appJobId: retry.id, ownerId: req.user!.id, timezone, input, usageId: usage.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background queue unavailable';
      await AiPlanJobModel.findByIdAndUpdate(retry._id, { status: 'FAILED', errorMessage: message.slice(0, 500), completedAt: new Date() });
      await completeAiUsage(usage.id, 'FAILED', { jobId: retry.id, errorMessage: message });
      throw error;
    }
    res.status(202).json({ jobId: retry.id, status: retry.status, retryOf: source._id, usage: await getUserAiUsage(req.user!.id), message: 'Retry safely queued. You can continue using LearnFlow and we will notify you when it finishes.' });
  } catch (error) { next(error); }
}

export async function listPlanJobs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await AiPlanJobModel.find({ ownerId: req.user!.id }).sort({ createdAt: -1 }).limit(100).lean()); }
  catch (error) { next(error); }
}

export async function getPlanJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const job = await AiPlanJobModel.findOne({ _id: req.params.id, ownerId: req.user!.id }).lean();
    if (!job) return res.status(404).json({ message: 'Learning plan job not found' });
    res.json(job);
  } catch (error) { next(error); }
}

export async function coach(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const input = coachSchema.parse(req.body);
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI coach is not configured for ${provider.provider}. Configure an AI provider key on Render.` });
    const usage = await reserveAiUsage(req.user!.id, req.user!.role, 'COACH', { hasContext: Boolean(input.context) });
    usageId = usage.id;
    const prompt = `You are the LearnFlow learning coach. Help the learner understand concepts, unblock study sessions, break work into realistic next steps, and improve consistency. Do not claim to have changed their LearnFlow data and do not invent completion status. Keep the response concise and practical.\n\nOptional learner context:\n${input.context ?? 'No extra context supplied.'}\n\nLearner message:\n${input.message}`;
    const answer = await generateAiText(prompt);
    await completeAiUsage(usage.id, 'SUCCEEDED');
    res.json({ answer, provider: provider.provider, model: provider.model, usage: await getUserAiUsage(req.user!.id) });
  } catch (error) {
    if (usageId) await completeAiUsage(usageId, 'FAILED', { errorMessage: error instanceof Error ? error.message : 'AI coach request failed' }).catch(() => undefined);
    next(error);
  }
}

export async function usageStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getUserAiUsage(req.user!.id)); }
  catch (error) { next(error); }
}

export async function providerStatus(_req: AuthenticatedRequest, res: Response) { res.json(getAiProviderInfo()); }
