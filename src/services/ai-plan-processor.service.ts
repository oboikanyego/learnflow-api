import { z } from 'zod';
import { AiPlanJobModel } from '../models/ai-plan-job.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { ModuleModel } from '../models/module.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { PhaseModel } from '../models/phase.model.js';
import { UserModel } from '../models/user.model.js';
import { localDateTimeToUtc } from '../utils/timezone.js';
import { generateAiTextWithProvider, type AiProvider } from './ai-provider.service.js';
import { completeAiUsage } from './ai-usage.service.js';
import { sendPlanCreatedEmail } from './learning-email.service.js';
import { invalidateLearningCache } from './redis.service.js';

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

const PLAN_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['learningPath', 'phases'],
  properties: {
    learningPath: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' }
      }
    },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'modules'],
        properties: {
          title: { type: 'string' },
          modules: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'lessons'],
              properties: {
                title: { type: 'string' },
                lessons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'description', 'date', 'time', 'durationMinutes', 'resourceUrl'],
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      date: { type: 'string' },
                      time: { type: 'string' },
                      durationMinutes: { type: 'integer', minimum: 5, maximum: 480 },
                      resourceUrl: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

const PLAN_GENERATION_CHUNK_WEEKS = 8;
const GROQ_CHUNK_DELAY_MS = 30_000;

export type PlanInput = z.infer<typeof planRequestSchema>;
type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
type PlanSegment = {
  weekStart: number;
  weekEnd: number;
  totalWeeks: number;
  priorContext?: string;
};

type GeneratedSegment = {
  plan: GeneratedPlan;
  provider: AiProvider;
};

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
  await invalidateLearningCache(ownerId, { learningPathId: path.id });
  return { learningPathId: path._id, learningPathIdString: path.id, lessonCount };
}

function addWeeks(dateText: string, weeks: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPlanPrompt(input: PlanInput, timezone: string, segment?: PlanSegment): string {
  const segmentWeeks = segment ? segment.weekEnd - segment.weekStart + 1 : input.weeks;
  const expectedLessons = segmentWeeks * input.days.length;
  const segmentText = segment
    ? `This request is only for weeks ${segment.weekStart}-${segment.weekEnd} of a ${segment.totalWeeks}-week curriculum. Continue the curriculum rather than restarting beginner material.`
    : `This request covers the full ${input.weeks}-week curriculum.`;
  const continuity = segment?.priorContext
    ? `Avoid repeating these recently covered items: ${segment.priorContext}.`
    : '';

  return `Create a practical learning plan for ${input.topic}. ${segmentText} Study days: ${input.days.join(', ')}. Segment start date: ${input.startDate}. Study time: ${input.time} in timezone ${timezone}. Session duration: ${input.durationMinutes} minutes. Generate exactly ${expectedLessons} lessons total: one lesson for each requested study day in every 7-day study week. Schedule lessons only on the requested study days, beginning on or after the segment start date. Keep the curriculum realistic, progressive and ordered. Keep each lesson description to one concise sentence. Organize lessons into sensible phases and modules. ${continuity} For resourceUrl use an empty string when no reliable URL is known. Return JSON only, matching the requested structured learning-plan schema.`;
}

function extractJsonText(text: string): string {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) return withoutFence.slice(firstBrace, lastBrace + 1);
  return withoutFence;
}

function parseGeneratedPlanText(text: string): GeneratedPlan {
  return generatedPlanSchema.parse(JSON.parse(extractJsonText(text)));
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return `schema validation failed: ${error.issues.slice(0, 3).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`;
  if (error instanceof Error) return error.message;
  return 'unknown JSON parsing error';
}

function buildRepairPrompt(input: PlanInput, timezone: string, brokenOutput: string, parseError: unknown, segment?: PlanSegment): string {
  return `Repair the following generated learning plan. The previous output could not be parsed or did not match the required schema. Preserve the intended learning content, but return a complete corrected plan. Do not explain the correction.\n\nOriginal request:\n${buildPlanPrompt(input, timezone, segment)}\n\nValidation problem:\n${parseErrorMessage(parseError)}\n\nBroken output:\n${brokenOutput.slice(0, 12_000)}`;
}

function continuationContext(plan: GeneratedPlan): string {
  const phaseTitles = plan.phases.slice(-2).map(phase => phase.title);
  const lessonTitles = plan.phases
    .flatMap(phase => phase.modules)
    .flatMap(module => module.lessons)
    .slice(-8)
    .map(lesson => lesson.title);
  return [...phaseTitles, ...lessonTitles].join(' | ').slice(0, 1_200);
}

async function generatePlanSegment(input: PlanInput, timezone: string, segment?: PlanSegment): Promise<GeneratedSegment> {
  const generationOptions = { responseSchema: PLAN_RESPONSE_SCHEMA, schemaName: 'learnflow_learning_plan' };
  const firstResult = await generateAiTextWithProvider(buildPlanPrompt(input, timezone, segment), generationOptions);

  try {
    return { plan: parseGeneratedPlanText(firstResult.text), provider: firstResult.provider };
  } catch (firstError) {
    console.warn(`[ai-plan] Structured plan response was invalid; attempting one repair generation: ${parseErrorMessage(firstError)}`);
    const repairedResult = await generateAiTextWithProvider(
      buildRepairPrompt(input, timezone, firstResult.text, firstError, segment),
      generationOptions
    );
    try {
      return { plan: parseGeneratedPlanText(repairedResult.text), provider: repairedResult.provider };
    } catch (repairError) {
      const error = Object.assign(
        new Error(`AI returned invalid learning-plan JSON after a structured retry: ${parseErrorMessage(repairError)}`),
        { statusCode: 502, exposeMessage: true }
      );
      throw error;
    }
  }
}

function mergePlanSegments(segments: GeneratedPlan[]): GeneratedPlan {
  const first = segments[0];
  if (!first) throw Object.assign(new Error('AI did not generate any learning-plan segments.'), { statusCode: 502, exposeMessage: true });

  return generatedPlanSchema.parse({
    learningPath: first.learningPath,
    phases: segments.flatMap(segment => segment.phases)
  });
}

export async function createGeneratedPlan(input: PlanInput, timezone: string) {
  if (input.weeks <= PLAN_GENERATION_CHUNK_WEEKS) {
    return (await generatePlanSegment(input, timezone)).plan;
  }

  const segments: GeneratedPlan[] = [];
  let priorContext: string | undefined;

  for (let weekStart = 1; weekStart <= input.weeks; weekStart += PLAN_GENERATION_CHUNK_WEEKS) {
    const weekEnd = Math.min(input.weeks, weekStart + PLAN_GENERATION_CHUNK_WEEKS - 1);
    const segmentInput: PlanInput = {
      ...input,
      weeks: weekEnd - weekStart + 1,
      startDate: addWeeks(input.startDate, weekStart - 1)
    };
    const segment: PlanSegment = { weekStart, weekEnd, totalWeeks: input.weeks, priorContext };

    console.log(`[ai-plan] Generating weeks ${weekStart}-${weekEnd} of ${input.weeks}.`);
    const generated = await generatePlanSegment(segmentInput, timezone, segment);
    segments.push(generated.plan);
    priorContext = continuationContext(generated.plan);

    if (generated.provider === 'groq' && weekEnd < input.weeks) {
      console.log('[ai-plan] Pacing Groq fallback before the next plan segment to stay within free-tier token limits.');
      await sleep(GROQ_CHUNK_DELAY_MS);
    }
  }

  return mergePlanSegments(segments);
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
