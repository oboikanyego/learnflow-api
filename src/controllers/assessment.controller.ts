import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AssessmentAttemptModel, AssessmentModel } from '../models/assessment.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { generateAiText, getAiProviderInfo } from '../services/ai-provider.service.js';
import { completeAiUsage, reserveAiUsage } from '../services/ai-usage.service.js';

const DAY = 86_400_000;
const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const submitSchema = z.object({ answers: z.array(z.number().int().min(0).max(3)).min(1).max(10) });
const generatedSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string().min(5).max(600),
    options: z.array(z.string().min(1).max(300)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(5).max(1200)
  })).min(3).max(7)
});

function parseGeneratedJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI assessment response did not contain valid JSON.');
  return generatedSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

function publicAssessment(assessment: any) {
  return {
    _id: String(assessment._id),
    lessonId: String(assessment.lessonId),
    createdAt: assessment.createdAt,
    questions: assessment.questions.map((question: any, index: number) => ({ index, prompt: question.prompt, options: question.options }))
  };
}

export async function generateLessonAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const ownerId = req.user!.id;
    const lessonId = idSchema.parse(req.params.lessonId);
    const lesson = await LessonModel.findOne({ _id: lessonId, ownerId }).lean();
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI assessment generation is not configured for ${provider.provider}.` });

    const usage = await reserveAiUsage(ownerId, req.user!.role, 'COACH', { mode: 'assessment-generation', lessonId });
    usageId = usage.id;
    const prompt = `Create a concise mastery checkpoint for this completed learning lesson. Return ONLY valid JSON with this exact shape: {"questions":[{"prompt":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}. Create 5 questions unless the lesson content is too thin, in which case create at least 3. Questions must test understanding and application, not trivia. Exactly one option must be correct. Do not mention information that is not supported by the lesson title, description, notes or resource context below.\n\nLesson title: ${lesson.title}\nDescription: ${lesson.description ?? 'None'}\nLearner notes: ${lesson.notes ?? 'None'}\nResource URL: ${lesson.resourceUrl ?? 'None'}`;
    const parsed = parseGeneratedJson(await generateAiText(prompt));
    const assessment = await AssessmentModel.create({ ownerId, lessonId, learningPathId: lesson.learningPathId, questions: parsed.questions, source: 'AI' });
    await completeAiUsage(usage.id, 'SUCCEEDED');
    res.status(201).json(publicAssessment(assessment));
  } catch (error) {
    if (usageId) await completeAiUsage(usageId, 'FAILED', { errorMessage: error instanceof Error ? error.message : 'Assessment generation failed' }).catch(() => undefined);
    next(error);
  }
}

export async function getLatestLessonAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessonId = idSchema.parse(req.params.lessonId);
    const assessment = await AssessmentModel.findOne({ ownerId, lessonId }).sort({ createdAt: -1 }).lean();
    if (!assessment) return res.status(404).json({ message: 'No assessment exists for this lesson yet.' });
    res.json(publicAssessment(assessment));
  } catch (error) { next(error); }
}

export async function submitAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const assessmentId = idSchema.parse(req.params.assessmentId);
    const input = submitSchema.parse(req.body);
    const assessment = await AssessmentModel.findOne({ _id: assessmentId, ownerId }).lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
    if (input.answers.length !== assessment.questions.length) return res.status(400).json({ message: 'Answer every question before submitting.' });

    const results = assessment.questions.map((question, index) => ({
      index,
      correct: input.answers[index] === question.correctIndex,
      selectedIndex: input.answers[index],
      correctIndex: question.correctIndex,
      explanation: question.explanation
    }));
    const correctAnswers = results.filter(item => item.correct).length;
    const score = Math.round((correctAnswers / assessment.questions.length) * 100);
    const weakQuestionIndexes = results.filter(item => !item.correct).map(item => item.index);
    const completedAt = new Date();
    const attempt = await AssessmentAttemptModel.create({ ownerId, assessmentId, lessonId: assessment.lessonId, answers: input.answers, score, correctAnswers, totalQuestions: assessment.questions.length, weakQuestionIndexes, completedAt });

    const reviewDelay = score < 60 ? 1 : score < 80 ? 3 : score < 90 ? 7 : 14;
    const confidenceFromScore = score < 60 ? 2 : score < 80 ? 3 : score < 90 ? 4 : 5;
    await LessonModel.updateOne({ _id: assessment.lessonId, ownerId }, {
      $set: { masteryScore: score, lastAssessedAt: completedAt, confidenceScore: confidenceFromScore, nextReviewAt: new Date(completedAt.getTime() + reviewDelay * DAY) },
      $inc: { assessmentAttempts: 1 }
    });

    res.json({ attemptId: String(attempt._id), score, correctAnswers, totalQuestions: assessment.questions.length, passed: score >= 70, masteryBand: score >= 90 ? 'MASTERED' : score >= 70 ? 'DEVELOPING' : 'NEEDS_REVIEW', results });
  } catch (error) { next(error); }
}

export async function getMasterySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const lessons = await LessonModel.find({ ownerId, assessmentAttempts: { $gt: 0 } }).select('title masteryScore assessmentAttempts lastAssessedAt confidenceScore nextReviewAt moduleId learningPathId').sort({ masteryScore: 1 }).lean();
    const scored = lessons.filter(item => typeof item.masteryScore === 'number');
    const averageMastery = scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.masteryScore ?? 0), 0) / scored.length) : 0;
    res.json({
      assessedLessons: scored.length,
      averageMastery,
      masteredLessons: scored.filter(item => (item.masteryScore ?? 0) >= 90).length,
      needsReview: scored.filter(item => (item.masteryScore ?? 0) < 70).length,
      lessons: scored.map(item => ({ id: String(item._id), title: item.title, masteryScore: item.masteryScore ?? 0, assessmentAttempts: item.assessmentAttempts ?? 0, lastAssessedAt: item.lastAssessedAt, confidenceScore: item.confidenceScore, nextReviewAt: item.nextReviewAt }))
    });
  } catch (error) { next(error); }
}
