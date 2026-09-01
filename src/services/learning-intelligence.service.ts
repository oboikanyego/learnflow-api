import { LessonModel } from '../models/lesson.model.js';
import { LearningPathModel } from '../models/learning-path.model.js';
import { ModuleModel } from '../models/module.model.js';
import { LearningGoalModel } from '../models/learning-goal.model.js';

const DAY = 86_400_000;

function startOfUtcDay(value: Date) { const d = new Date(value); d.setUTCHours(0, 0, 0, 0); return d; }
function startOfWeek(value = new Date()) { const d = startOfUtcDay(value); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; }
function dayKey(value: Date) { return value.toISOString().slice(0, 10); }

export async function getLearningIntelligence(ownerId: string) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const [lessons, paths, modules, goals] = await Promise.all([
    LessonModel.find({ ownerId }).select('title status durationMinutes completedAt scheduledAt learningPathId moduleId').lean(),
    LearningPathModel.find({ ownerId }).select('title status').lean(),
    ModuleModel.find({ ownerId }).select('title learningPathId').lean(),
    LearningGoalModel.find({ ownerId, status: 'ACTIVE' }).lean()
  ]);

  const completed = lessons.filter(l => l.status === 'COMPLETED');
  const completedDates = [...new Set(completed.filter(l => l.completedAt).map(l => dayKey(startOfUtcDay(new Date(l.completedAt!)))))].sort();
  let currentStreak = 0;
  const cursor = startOfUtcDay(now);
  const activeDays = new Set(completedDates);
  if (!activeDays.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (activeDays.has(dayKey(cursor))) { currentStreak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }

  let longestStreak = 0; let run = 0; let previous: Date | undefined;
  for (const key of completedDates) {
    const current = new Date(`${key}T00:00:00.000Z`);
    run = previous && current.getTime() - previous.getTime() === DAY ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = current;
  }

  const weekLessons = lessons.filter(l => {
    const value = l.completedAt ?? l.scheduledAt;
    return value && new Date(value) >= weekStart && new Date(value) < weekEnd;
  });
  const weekCompleted = weekLessons.filter(l => l.status === 'COMPLETED');
  const weekMissed = weekLessons.filter(l => l.status === 'MISSED');
  const weekMinutes = weekCompleted.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  const considered = weekCompleted.length + weekMissed.length;

  const moduleStats = modules.map(module => {
    const rows = lessons.filter(l => String(l.moduleId) === String(module._id));
    const done = rows.filter(l => l.status === 'COMPLETED').length;
    const missed = rows.filter(l => l.status === 'MISSED').length;
    return { moduleId: String(module._id), title: module.title, total: rows.length, completed: done, missed, completionRate: rows.length ? Math.round(done / rows.length * 100) : 0 };
  }).filter(item => item.total > 0);

  const pathStats = paths.map(path => {
    const rows = lessons.filter(l => String(l.learningPathId) === String(path._id));
    const done = rows.filter(l => l.status === 'COMPLETED').length;
    return { learningPathId: String(path._id), title: path.title, total: rows.length, completed: done, completionRate: rows.length ? Math.round(done / rows.length * 100) : 0 };
  }).filter(item => item.total > 0).sort((a, b) => b.completionRate - a.completionRate);

  const upcoming = lessons.filter(l => l.status === 'SCHEDULED' && l.scheduledAt && new Date(l.scheduledAt) >= now).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()).slice(0, 12);
  const overdue = lessons.filter(l => ['MISSED'].includes(l.status));
  const totalGoalMinutes = goals.reduce((sum, goal) => sum + goal.weeklyMinutesTarget, 0);

  const achievements = [
    { key: 'FIRST_LESSON', title: 'First lesson completed', unlocked: completed.length >= 1 },
    { key: 'TEN_LESSONS', title: '10 lessons completed', unlocked: completed.length >= 10 },
    { key: 'TEN_HOURS', title: '10 hours studied', unlocked: completed.reduce((s, l) => s + (l.durationMinutes || 0), 0) >= 600 },
    { key: 'SEVEN_DAY_STREAK', title: '7-day consistency streak', unlocked: longestStreak >= 7 },
    { key: 'THIRTY_DAY_STREAK', title: '30-day consistency streak', unlocked: longestStreak >= 30 },
    { key: 'HUNDRED_LESSONS', title: '100 lessons completed', unlocked: completed.length >= 100 },
    { key: 'PATH_COMPLETE', title: 'Learning path completed', unlocked: paths.some(p => p.status === 'COMPLETED') }
  ];

  return {
    generatedAt: now.toISOString(),
    week: { start: weekStart.toISOString(), end: weekEnd.toISOString(), completed: weekCompleted.length, missed: weekMissed.length, studiedMinutes: weekMinutes, completionRate: considered ? Math.round(weekCompleted.length / considered * 100) : 100, weeklyTargetMinutes: totalGoalMinutes, targetProgress: totalGoalMinutes ? Math.min(100, Math.round(weekMinutes / totalGoalMinutes * 100)) : 0 },
    consistency: { currentStreakDays: currentStreak, longestStreakDays: longestStreak, activeLearningDays: completedDates.length },
    strongestPath: pathStats[0] ?? null,
    weakestModules: moduleStats.filter(m => m.missed > 0 || m.completionRate < 60).sort((a, b) => a.completionRate - b.completionRate).slice(0, 5),
    upcoming: upcoming.map(l => ({ id: String(l._id), title: l.title, scheduledAt: l.scheduledAt, durationMinutes: l.durationMinutes })),
    missedLessons: overdue.length,
    goals: goals.map(goal => ({ id: String(goal._id), title: goal.title, targetDate: goal.targetDate, weeklyMinutesTarget: goal.weeklyMinutesTarget })),
    achievements,
    pathStats,
    moduleStats
  };
}

export function coachContextFromIntelligence(value: Awaited<ReturnType<typeof getLearningIntelligence>>) {
  return JSON.stringify({
    currentWeek: value.week,
    consistency: value.consistency,
    strongestPath: value.strongestPath,
    weakestModules: value.weakestModules,
    upcomingLessons: value.upcoming.slice(0, 8),
    missedLessons: value.missedLessons,
    goals: value.goals
  }, null, 2);
}

export async function buildReplanProposal(ownerId: string) {
  const now = new Date();
  const missed = await LessonModel.find({ ownerId, status: 'MISSED' }).sort({ scheduledAt: 1 }).limit(12).lean();
  const scheduled = await LessonModel.find({ ownerId, status: 'SCHEDULED', scheduledAt: { $gte: now } }).sort({ scheduledAt: 1 }).limit(50).lean();
  const occupied = scheduled.map(l => new Date(l.scheduledAt!).getTime());
  const changes: Array<{ lessonId: string; title: string; previousScheduledAt?: Date; proposedScheduledAt: Date; durationMinutes: number }> = [];
  let cursor = new Date(now.getTime() + DAY);
  cursor.setUTCHours(18, 0, 0, 0);

  for (const lesson of missed) {
    while (occupied.some(time => Math.abs(time - cursor.getTime()) < 90 * 60_000)) cursor = new Date(cursor.getTime() + DAY);
    changes.push({ lessonId: String(lesson._id), title: lesson.title, previousScheduledAt: lesson.scheduledAt, proposedScheduledAt: new Date(cursor), durationMinutes: lesson.durationMinutes });
    occupied.push(cursor.getTime());
    cursor = new Date(cursor.getTime() + DAY);
  }
  return { generatedAt: now.toISOString(), behindMinutes: missed.reduce((s, l) => s + (l.durationMinutes || 0), 0), changes };
}

export async function applyReplanProposal(ownerId: string, changes: Array<{ lessonId: string; proposedScheduledAt: string }>) {
  let updated = 0;
  for (const change of changes) {
    const result = await LessonModel.updateOne({ _id: change.lessonId, ownerId }, { $set: { scheduledAt: new Date(change.proposedScheduledAt), status: 'SCHEDULED', reminderSentAt: null, missedAt: null } });
    updated += result.modifiedCount;
  }
  return { updated };
}
