import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { brandedEmail } from './email-template.service.js';
import { emailService, type EmailSendResult } from './email.service.js';

function clientUrl(path: string): string {
  return `${env.CLIENT_ORIGIN.replace(/\/$/, '')}${path}`;
}

export async function sendPlanCreatedEmail(input: {
  ownerId: string;
  learningPathId?: string;
  jobId?: string;
  title: string;
  source?: 'created' | 'imported' | 'ai';
  lessonCount?: number;
}): Promise<EmailSendResult> {
  if (!env.RESEND_API_KEY) {
    return { status: 'SKIPPED', provider: 'resend', errorMessage: 'RESEND_API_KEY is not configured' };
  }

  const user = await UserModel.findById(input.ownerId).select('name email notificationPreferences').lean();
  if (!user?.email) {
    return { status: 'SKIPPED', provider: 'resend', errorMessage: 'No email address available' };
  }
  if (user.notificationPreferences?.celebrationEmails === false) {
    return { status: 'SKIPPED', provider: 'resend', errorMessage: 'Celebration emails disabled' };
  }

  const saved = Boolean(input.learningPathId);
  const sourceText = input.source === 'imported'
    ? 'Your imported learning plan is ready in LearnFlow.'
    : input.source === 'ai'
      ? saved
        ? 'Your AI-generated learning plan is ready and saved in LearnFlow.'
        : 'Your AI-generated learning plan is ready to preview in LearnFlow.'
      : 'Your new learning plan is ready in LearnFlow.';

  const detailRows = [
    { label: 'Learning path', value: input.title },
    ...(input.lessonCount !== undefined ? [{ label: 'Lessons', value: String(input.lessonCount) }] : [])
  ];

  const destination = input.learningPathId
    ? `/learning-paths/${encodeURIComponent(input.learningPathId)}`
    : input.jobId
      ? `/ai-planner?job=${encodeURIComponent(input.jobId)}`
      : '/learning-paths';

  const content = brandedEmail({
    preheader: `${input.title} is ready to start`,
    eyebrow: input.source === 'ai' ? 'AI learning plan' : 'New learning path',
    title: input.source === 'ai' ? 'Your AI learning plan is ready 🎉' : 'Your new learning plan is ready 🎉',
    greeting: user.name,
    tone: 'success',
    body: [
      sourceText,
      saved
        ? 'You have done the planning part. Review the structure, adjust anything that does not fit, and start working through the lessons at your own pace.'
        : 'Open the generated roadmap to review the structure. You can generate and save a version when you are ready to add it to your learning workspace.'
    ],
    detailRows,
    ctaLabel: saved ? 'Open learning path' : 'Preview learning plan',
    ctaUrl: clientUrl(destination),
    note: saved
      ? 'Tip: keep your lesson dates realistic. LearnFlow will remind you when a scheduled learning session is approaching.'
      : 'Your generated preview remains available from your AI request history.'
  });

  const result = await emailService.send({
    to: user.email,
    subject: `Your LearnFlow plan is ready: ${input.title}`,
    ...content
  });

  if (result.status !== 'SENT') {
    console.error('LearnFlow plan email was not sent', {
      ownerId: input.ownerId,
      jobId: input.jobId,
      learningPathId: input.learningPathId,
      status: result.status,
      errorMessage: result.errorMessage
    });
  }

  return result;
}
