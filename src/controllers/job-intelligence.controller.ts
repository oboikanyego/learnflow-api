import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SkillEvidenceModel, type SkillLevel } from '../models/career.model.js';
import { JobAnalysisModel } from '../models/job-match.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { generateAiText, getAiProviderInfo } from '../services/ai-provider.service.js';
import { completeAiUsage, reserveAiUsage } from '../services/ai-usage.service.js';

const rank: Record<SkillLevel, number> = { FOUNDATION: 1, WORKING: 2, STRONG: 3 };
const analyseSchema = z.object({
  title: z.string().min(2).max(160),
  company: z.string().max(160).optional(),
  jobDescription: z.string().min(80).max(20000)
});
const parsedSchema = z.object({
  requirements: z.array(z.object({
    name: z.string().min(1).max(80),
    targetLevel: z.enum(['FOUNDATION','WORKING','STRONG']),
    importance: z.enum(['REQUIRED','PREFERRED'])
  })).min(1).max(30),
  interviewQuestions: z.array(z.string().min(5).max(300)).max(12).default([])
});

function parseJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI job analysis did not contain valid JSON.');
  return parsedSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

function evidenceLevel(evidence: any, lesson?: any): SkillLevel {
  if (evidence.evidenceType === 'LESSON') {
    const score = lesson?.masteryScore ?? 0;
    return score >= 90 ? 'STRONG' : score >= 70 ? 'WORKING' : 'FOUNDATION';
  }
  return evidence.evidenceType === 'PROJECT' || evidence.evidenceType === 'CERTIFICATE' ? 'WORKING' : 'FOUNDATION';
}

async function buildSkillProfile(ownerId: string) {
  const evidence = await SkillEvidenceModel.find({ ownerId }).lean();
  const lessonIds = evidence.filter(item => item.lessonId).map(item => item.lessonId!);
  const lessons = lessonIds.length ? await LessonModel.find({ ownerId, _id: { $in: lessonIds } }).select('title masteryScore').lean() : [];
  const lessonMap = new Map(lessons.map(item => [String(item._id), item]));
  const grouped = new Map<string, Array<{ level: SkillLevel; title: string; type: string; url?: string; masteryScore?: number }>>();
  for (const item of evidence) {
    const lesson = item.lessonId ? lessonMap.get(String(item.lessonId)) : undefined;
    const key = item.skillName.trim().toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), {
      level: evidenceLevel(item, lesson),
      title: item.title,
      type: item.evidenceType,
      url: item.url,
      masteryScore: lesson?.masteryScore
    }]);
  }
  return [...grouped.entries()].map(([key, items]) => ({
    key,
    name: key,
    level: items.reduce<SkillLevel>((best, item) => rank[item.level] > rank[best] ? item.level : best, 'FOUNDATION'),
    evidence: items
  }));
}

function analyseMatch(requirements: Array<{ name: string; targetLevel: SkillLevel; importance: 'REQUIRED'|'PREFERRED' }>, skills: Awaited<ReturnType<typeof buildSkillProfile>>) {
  const rows = requirements.map(requirement => {
    const skill = skills.find(item => item.key === requirement.name.trim().toLowerCase());
    const currentLevel = skill?.level ?? null;
    const met = !!currentLevel && rank[currentLevel] >= rank[requirement.targetLevel];
    return { ...requirement, currentLevel, met, evidence: skill?.evidence ?? [] };
  });
  const required = rows.filter(row => row.importance === 'REQUIRED');
  const preferred = rows.filter(row => row.importance === 'PREFERRED');
  const requiredScore = required.length ? required.filter(row => row.met).length / required.length : 0;
  const preferredScore = preferred.length ? preferred.filter(row => row.met).length / preferred.length : 0;
  const totalWeight = (required.length ? 0.8 : 0) + (preferred.length ? 0.2 : 0);
  const score = totalWeight ? Math.round(((requiredScore * (required.length ? 0.8 : 0)) + (preferredScore * (preferred.length ? 0.2 : 0))) / totalWeight * 100) : 0;
  return { score, matched: rows.filter(row => row.met), gaps: rows.filter(row => !row.met), requirements: rows };
}

function talkingPoints(match: ReturnType<typeof analyseMatch>) {
  return match.matched.slice(0, 6).map(item => {
    const strongest = [...item.evidence].sort((a,b) => rank[b.level] - rank[a.level])[0];
    return strongest
      ? `${item.name}: evidence from ${strongest.title}${typeof strongest.masteryScore === 'number' ? ` with ${strongest.masteryScore}% mastery` : ''}.`
      : `${item.name}: evidence-backed requirement met.`;
  });
}

export async function analyseJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let usageId: string | undefined;
  try {
    const ownerId = req.user!.id;
    const input = analyseSchema.parse(req.body);
    const provider = getAiProviderInfo();
    if (!provider.configured) return res.status(503).json({ message: `AI job analysis is not configured for ${provider.provider}.` });
    const usage = await reserveAiUsage(ownerId, req.user!.role, 'COACH', { mode: 'job-analysis', title: input.title });
    usageId = String(usage._id);
    const prompt = `Extract technical and professional skill requirements from this job description. Return ONLY JSON with {"requirements":[{"name":"Angular","targetLevel":"STRONG","importance":"REQUIRED"}],"interviewQuestions":["..."]}. Normalize duplicate skill names. Use FOUNDATION for basic familiarity, WORKING for practical hands-on expectations, STRONG for advanced/senior/ownership expectations. Mark explicit must-haves REQUIRED and nice-to-haves PREFERRED. Do not invent skills not supported by the description. Create up to 8 likely interview questions grounded in the description.\n\nRole: ${input.title}\nCompany: ${input.company ?? 'Not supplied'}\n\n${input.jobDescription}`;
    const parsed = parseJson(await generateAiText(prompt));
    const skills = await buildSkillProfile(ownerId);
    const match = analyseMatch(parsed.requirements, skills);
    const points = talkingPoints(match);
    const analysis = await JobAnalysisModel.create({ ...input, ownerId, requirements: parsed.requirements, talkingPoints: points, interviewQuestions: parsed.interviewQuestions });
    await completeAiUsage(usageId, 'SUCCEEDED');
    res.status(201).json({ id: String(analysis._id), title: analysis.title, company: analysis.company, createdAt: analysis.createdAt, match, talkingPoints: points, interviewQuestions: parsed.interviewQuestions, learningPlanBrief: match.gaps.map(gap => `${gap.name}: build from ${gap.currentLevel ?? 'NO EVIDENCE'} to ${gap.targetLevel}`).join('\n') });
  } catch (error) {
    if (usageId) await completeAiUsage(usageId, 'FAILED', { errorMessage: error instanceof Error ? error.message : 'Job analysis failed' }).catch(() => undefined);
    next(error);
  }
}

export async function listJobAnalyses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const rows = await JobAnalysisModel.find({ ownerId: req.user!.id }).sort({ createdAt: -1 }).limit(25).select('title company requirements createdAt').lean();
    res.json(rows.map(row => ({ id: String(row._id), title: row.title, company: row.company, requirementCount: row.requirements.length, createdAt: row.createdAt })));
  } catch (error) { next(error); }
}

export async function getJobAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const analysis = await JobAnalysisModel.findOne({ _id: req.params.analysisId, ownerId: req.user!.id }).lean();
    if (!analysis) return res.status(404).json({ message: 'Job analysis not found.' });
    const skills = await buildSkillProfile(req.user!.id);
    const match = analyseMatch(analysis.requirements, skills);
    res.json({ id: String(analysis._id), title: analysis.title, company: analysis.company, jobDescription: analysis.jobDescription, createdAt: analysis.createdAt, match, talkingPoints: talkingPoints(match), interviewQuestions: analysis.interviewQuestions, learningPlanBrief: match.gaps.map(gap => `${gap.name}: build from ${gap.currentLevel ?? 'NO EVIDENCE'} to ${gap.targetLevel}`).join('\n') });
  } catch (error) { next(error); }
}
