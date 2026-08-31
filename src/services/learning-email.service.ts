import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { brandedEmail } from './email-template.service.js';
import { emailService } from './email.service.js';

function pathUrl(pathId: string): string {
  return `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/learning-paths/${encodeURIComponent(pathId)}`;
}

export async function sendPlanCreatedEmail(input: {
  ownerId: string;
  learningPathId: string;
  title: string;
  source?: 'created' | 'imported' | 'ai';
  lessonCount?: number;
}): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const user = await UserModel.findById(input.ownerId).select('name email').lean();
  if (!user?.email) return;

  const sourceText = input.source === 'imported'
    ? 'Your imported learning plan is ready in LearnFlow.'
    : input.source === 'ai'
      ? 'Your AI-generated learning plan is ready and saved in LearnFlow.'
      : 'Your new learning plan is ready in LearnFlow.';

  const detailRows = [
    { label: 'Learning path', value: input.title },
    ...(input.lessonCount !== undefined ? [{ label: 'Lessons', value: String(input.lessonCount) }] : [])
  ];

  const content = brandedEmail({
    preheader: `${input.title} is ready to start`,
    eyebrow: 'New learning path',
    title: 'Your new learning plan is ready 🎉',
    greeting: user.name,
    tone: 'success',
    body: [
      sourceText,
      'You have done the planning part. Now you can review the structure, adjust anything that does not fit, and start working through the lessons at your own pace.'
    ],
    detailRows,
    ctaLabel: 'Open learning path',
    ctaUrl: pathUrl(input.learningPathId),
    note: 'Tip: keep your lesson dates realistic. LearnFlow will remind you when a scheduled learning session is approaching.'
  });

  await emailService.send({
    to: user.email,
    subject: `Your LearnFlow plan is ready: ${input.title}`,
    ...content
  });
}
