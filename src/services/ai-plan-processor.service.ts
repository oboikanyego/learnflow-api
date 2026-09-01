import { z } from 'zod';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { ModuleModel } from '../models/module.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { UserModel } from '../models/user.model.js';
import { localDateTimeToUtc } from '../utils/timezone.js';
import { generateAiText } from './ai-provider.service.js';
import { completeAiUsage } from './ai-usage.service.js';
import { sendPlanCreatedEmail } from './learning-email.service.js';

export const planRequestSchema = z.object({
  topic: z.string().min(2).max(120),
  weeks: z.number().int().min(1).max(52),
  days: z.array(z.string()).min(1).max(7),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  save: z.boolean().default(false)
});

export const generatedPlanSchema = z.object({
  learningPath: z.object({ title: z.string().min(2), description: z.string().optional() }),
  phases: z.array(z.object({
    title: z.string().min(1),
    modules: z.array(z.object({
      title: z.string().min(1),
      lessons: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        date: z.string(),
        time: z.string(),
        durationMinutes: z.number().int().min(5).max(480),
        resourceUrl: z.string().optional()
      }))
    }))
  }))
});

export type PlanInput = z.infer<typeof planRequestSchema>;
type GeneratedPlan = z.infer<typeof generatedPlanSchema>;

export async function getUserTimezone(userId: string): Promise<string> {
  const user = await UserModel.findById(userId).select('timezone').lean();
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user.timezone;
}

function countLessons(plan: GeneratedPlan): number {
  return plan.phases.reduce((phaseTotal, phase) =>
    phaseTotal + phase.modules.reduce((moduleTotal, module) => moduleTotal + module.lessons.length, 0), 0);
}

export async function persistGeneratedPlan(ownerId: string, timezone: string, rawPlan: unknown) {
  const plan = generatedPlanSchema.parse(rawPlan);
  const path = await LearningPathModel.create({ ownerId, title: plan.learningPath.title, description: plan.learningPath.description, status: 'ACTIVE' });
  let lessonCount = 0;
  for (let p = 0; p < plan.phases.length; p++) {
    const phaseData = plan.phases[p]!;
    const phase = await PhaseModel.create({ ownerId, learningPathId: path._id, title: phaseData.title, position: p });
    for (let m = 0; m < phaseData.modules.length; m++) {
      const moduleData = phaseData.modules[m]!;
      const module = await ModuleModel.create({ ownerId, learningPathId: path._id, phaseId: phase._id, title: moduleData.title, position: m });
      for (let l = 0; l < moduleData.lessons.length; l++) {
        const lesson = moduleData.lessons[l]!;
        const scheduledAt = localDateTimeToUtc(lesson.date, lesson.time, timezone);
        await LessonModel.create({ ownerId, learningPathId: path._id, phaseId: phase._id, moduleId: module._id, title: lesson.title, description: lesson.description, resourceUrl: lesson.resourceUrl || undefined, durationMinutes: lesson.durationMinutes, position: l, scheduledAt, status: scheduledAt ? 'SCHEDULED' : 'BACKLOG' });
        lessonCount++;
      }
    }
  }
  return { learningPathId: path._id, learningPathIdString: path.id, lessonCount };
}

function buildPlanPrompt(input: PlanInput, timezone: string): string {
  return `Create a practical learning plan for ${input.topic}. Duration: ${input.weeks} weeks. Study days: ${input.days.join(', ')}. Start date: ${input.startDate}. Study time: ${input.time} in timezone ${timezone}. Session duration: ${input.durationMinutes} minutes. Return ONLY valid JSON with shape {"learningPath":{"title":"...","description":"..."},"phases":[{"title":"...","modules":[{"title":"...","lessons":[{"title":"...","description":"...","date":"YYYY-MM-DD","time":"HH:mm","durationMinutes":60,"resourceUrl":""}]}]}]}. Keep lessons realistic and ordered. Do not include markdown fences.`;
}

export async function createGeneratedPlan(input: PlanInput, timezone: string) {
  const text = await generateAiText(buildPlanPrompt(input, timezone));
  return generatedPlanSchema.parse(JSON.parse(text.replace(/^```json\s*|```$/g, '').trim()));
}

export async function processAiPlanJob(jobId: string, ownerId: string, timezone: string, input: PlanInput, usageId?: string): Promise<void> {
  await AiPlanJobModel.findOneAndUpdate({ _id: jobId, ownerId }, { status: 'PROCESSING', startedAt: new Date(), errorMessage: undefined, completedAt: undefined });
  try {
    const parsed = await createGeneratedPlan(input, timezone);
    const persisted = input.save ? await persistGeneratedPlan(ownerId, timezone, parsed) : undefined;
    const learningPathId = persisted?.learningPathId;

    await AiPlanJobModel.findOneAndUpdate({ _id: jobId, ownerId }, { status: 'COMPLETED', plan: parsed, learningPathId, completedAt: new Date(), errorMessage: undefined });
    if (usageId) await completeAiUsage(usageId, 'SUCCEEDED', { jobId });

    await NotificationModel.create({
      ownerId,
      type: 'AI_PLAN_READY',
      title: 'Your learning plan is ready',
      message: `The ${parsed.learningPath.title} roadmap has finished generating. You can preview it now.`,
      actionUrl: `/ai-planner?job=${jobId}`
    });

    const emailResult = await sendPlanCreatedEmail({
      ownerId,
      learningPathId: persisted?.learningPathIdString,
      jobId,
      title: parsed.learningPath.title,
      source: 'ai',
      lessonCount: persisted?.lessonCount ?? countLessons(parsed)
    });

    if (emailResult.status === 'FAILED') {
      await NotificationModel.create({
        ownerId,
        type: 'AI_PLAN_READY',
        title: 'Your plan is ready, but email delivery failed',
        message: 'The learning plan was generated successfully, but LearnFlow could not send the email notification. Your plan is still available in the app.',
        actionUrl: `/ai-planner?job=${jobId}`
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Learning plan generation failed';
    await AiPlanJobModel.findOneAndUpdate({ _id: jobId, ownerId }, { status: 'FAILED', errorMessage: message.slice(0, 500), completedAt: new Date() });
    throw error;
  }
}

export async function markAiPlanJobPermanentlyFailed(jobId: string, ownerId: string, error: unknown, usageId?: string): Promise<void> {
  const message = error instanceof Error ? error.message : 'Learning plan generation failed';
  await AiPlanJobModel.findOneAndUpdate({ _id: jobId, ownerId }, { status: 'FAILED', errorMessage: message.slice(0, 500), completedAt: new Date() });
  if (usageId) await completeAiUsage(usageId, 'FAILED', { jobId, errorMessage: message });
  await NotificationModel.create({ ownerId, type: 'AI_PLAN_FAILED', title: 'Learning plan generation failed', message: 'We could not finish generating your learning plan after retrying it. Open AI requests to retry it manually.', actionUrl: '/ai-requests' });
}
