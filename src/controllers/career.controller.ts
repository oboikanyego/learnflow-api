import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CareerTargetModel, SkillEvidenceModel, type SkillLevel } from '../models/career.model.js';
import { LessonModel } from '../models/lesson.model.js';

const levelSchema = z.enum(['FOUNDATION','WORKING','STRONG']);
const targetSchema = z.object({
  roleTitle: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  requiredSkills: z.array(z.object({ name: z.string().min(1).max(80), targetLevel: levelSchema })).min(1).max(30)
});
const evidenceSchema = z.object({
  skillName: z.string().min(1).max(80),
  evidenceType: z.enum(['LESSON','PROJECT','CERTIFICATE','LINK']),
  title: z.string().min(2).max(180),
  description: z.string().max(1500).optional(),
  url: z.string().url().optional(),
  lessonId: z.string().refine(Types.ObjectId.isValid, 'Invalid lesson id').optional()
});
const idSchema = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const rank: Record<SkillLevel, number> = { FOUNDATION: 1, WORKING: 2, STRONG: 3 };

function evidenceLevel(evidence: any, lesson?: any): SkillLevel {
  if (evidence.evidenceType === 'LESSON') {
    const score = lesson?.masteryScore ?? 0;
    if (score >= 90) return 'STRONG';
    if (score >= 70) return 'WORKING';
    return 'FOUNDATION';
  }
  if (evidence.evidenceType === 'PROJECT' || evidence.evidenceType === 'CERTIFICATE') return 'WORKING';
  return 'FOUNDATION';
}

export async function upsertCareerTarget(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const input = targetSchema.parse(req.body);
    const requiredSkills = input.requiredSkills.map(item => ({ name: item.name.trim(), targetLevel: item.targetLevel }));
    const target = await CareerTargetModel.findOneAndUpdate({ ownerId }, { ...input, requiredSkills }, { upsert: true, new: true, runValidators: true });
    res.json(target);
  } catch (error) { next(error); }
}

export async function addSkillEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const input = evidenceSchema.parse(req.body);
    if (input.evidenceType === 'LESSON') {
      if (!input.lessonId) return res.status(400).json({ message: 'lessonId is required for lesson evidence.' });
      const lesson = await LessonModel.findOne({ _id: input.lessonId, ownerId }).select('_id').lean();
      if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
    }
    const evidence = await SkillEvidenceModel.create({ ...input, skillName: input.skillName.trim(), ownerId });
    res.status(201).json(evidence);
  } catch (error) { next(error); }
}

export async function deleteSkillEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const evidenceId = idSchema.parse(req.params.evidenceId);
    const removed = await SkillEvidenceModel.findOneAndDelete({ _id: evidenceId, ownerId });
    if (!removed) return res.status(404).json({ message: 'Skill evidence not found.' });
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function getCareerOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ownerId = req.user!.id;
    const [target, evidence] = await Promise.all([
      CareerTargetModel.findOne({ ownerId }).lean(),
      SkillEvidenceModel.find({ ownerId }).sort({ createdAt: -1 }).lean()
    ]);
    const lessonIds = evidence.filter(item => item.lessonId).map(item => item.lessonId!);
    const lessons = lessonIds.length ? await LessonModel.find({ ownerId, _id: { $in: lessonIds } }).select('title masteryScore confidenceScore assessmentAttempts status completedAt').lean() : [];
    const lessonMap = new Map(lessons.map(item => [String(item._id), item]));
    const enriched = evidence.map(item => {
      const lesson = item.lessonId ? lessonMap.get(String(item.lessonId)) : undefined;
      return { ...item, derivedLevel: evidenceLevel(item, lesson), lesson: lesson ? { id: String(lesson._id), title: lesson.title, masteryScore: lesson.masteryScore ?? null, confidenceScore: lesson.confidenceScore ?? null, assessmentAttempts: lesson.assessmentAttempts ?? 0, status: lesson.status } : null };
    });
    const bySkill = new Map<string, typeof enriched>();
    for (const item of enriched) { const key = item.skillName.trim().toLowerCase(); bySkill.set(key, [...(bySkill.get(key) ?? []), item]); }
    const skillProfile = [...bySkill.entries()].map(([key, items]) => {
      const best = items.reduce<SkillLevel>((level, item) => rank[item.derivedLevel] > rank[level] ? item.derivedLevel : level, 'FOUNDATION');
      const assessed = items.map(item => item.lesson?.masteryScore).filter((value): value is number => typeof value === 'number');
      return { key, name: items[0]?.skillName ?? key, level: best, evidenceCount: items.length, masteryScore: assessed.length ? Math.max(...assessed) : null, evidence: items };
    }).sort((a,b) => rank[b.level] - rank[a.level] || a.name.localeCompare(b.name));

    const requirements = target?.requiredSkills ?? [];
    const readiness = requirements.map(requirement => {
      const skill = skillProfile.find(item => item.key === requirement.name.trim().toLowerCase());
      const currentLevel = skill?.level ?? null;
      const met = !!currentLevel && rank[currentLevel] >= rank[requirement.targetLevel];
      return { name: requirement.name, targetLevel: requirement.targetLevel, currentLevel, met, evidenceCount: skill?.evidenceCount ?? 0, masteryScore: skill?.masteryScore ?? null };
    });
    const metCount = readiness.filter(item => item.met).length;
    const readinessScore = readiness.length ? Math.round(metCount / readiness.length * 100) : 0;
    const portfolioReadyEvidence = enriched.filter(item => (item.evidenceType === 'PROJECT' || item.evidenceType === 'CERTIFICATE') && !!item.url).length;

    res.json({
      generatedAt: new Date().toISOString(),
      target: target ? { id: String(target._id), roleTitle: target.roleTitle, description: target.description, requiredSkills: target.requiredSkills } : null,
      readiness: { score: readinessScore, metSkills: metCount, totalSkills: readiness.length, gaps: readiness.filter(item => !item.met), requirements: readiness },
      portfolio: { evidenceCount: enriched.length, portfolioReadyEvidence, lessonEvidence: enriched.filter(item => item.evidenceType === 'LESSON').length, projectEvidence: enriched.filter(item => item.evidenceType === 'PROJECT').length },
      skills: skillProfile
    });
  } catch (error) { next(error); }
}
