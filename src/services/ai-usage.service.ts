import { env } from '../config/env.js';
import { AiUsageModel, type AiUsageFeature } from '../models/ai-usage.model.js';
import { UserModel, type EntitlementPlan } from '../models/user.model.js';
import { getAiProviderInfo } from './ai-provider.service.js';

function startOfUtcDay(now = new Date()): Date { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); }
function startOfUtcMonth(now = new Date()): Date { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }
function limits(feature: AiUsageFeature, plan: EntitlementPlan) {
  if (plan === 'PRO') return feature === 'PLAN'
    ? { daily: env.PRO_AI_PLAN_DAILY_LIMIT, monthly: env.PRO_AI_PLAN_MONTHLY_LIMIT }
    : { daily: env.PRO_AI_COACH_DAILY_LIMIT, monthly: env.PRO_AI_COACH_MONTHLY_LIMIT };
  return feature === 'PLAN'
    ? { daily: env.AI_PLAN_DAILY_LIMIT, monthly: env.AI_PLAN_MONTHLY_LIMIT }
    : { daily: env.AI_COACH_DAILY_LIMIT, monthly: env.AI_COACH_MONTHLY_LIMIT };
}

export async function getUserAiUsage(ownerId: string) {
  const now = new Date(); const dayStart = startOfUtcDay(now); const monthStart = startOfUtcMonth(now); const counted = { status: { $in: ['ACCEPTED', 'SUCCEEDED', 'FAILED'] } };
  const [user, planDaily, planMonthly, coachDaily, coachMonthly] = await Promise.all([
    UserModel.findById(ownerId).select('entitlement').lean(),
    AiUsageModel.countDocuments({ ownerId, feature: 'PLAN', createdAt: { $gte: dayStart }, ...counted }),
    AiUsageModel.countDocuments({ ownerId, feature: 'PLAN', createdAt: { $gte: monthStart }, ...counted }),
    AiUsageModel.countDocuments({ ownerId, feature: 'COACH', createdAt: { $gte: dayStart }, ...counted }),
    AiUsageModel.countDocuments({ ownerId, feature: 'COACH', createdAt: { $gte: monthStart }, ...counted })
  ]);
  const plan: EntitlementPlan = user?.entitlement?.plan ?? 'FREE'; const planLimits = limits('PLAN', plan); const coachLimits = limits('COACH', plan);
  return { entitlement: { plan, status: user?.entitlement?.status ?? 'ACTIVE' }, resetsAt: { daily: new Date(dayStart.getTime() + 24 * 60 * 60_000), monthly: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) }, plan: { daily: { used: planDaily, limit: planLimits.daily, remaining: Math.max(0, planLimits.daily - planDaily) }, monthly: { used: planMonthly, limit: planLimits.monthly, remaining: Math.max(0, planLimits.monthly - planMonthly) } }, coach: { daily: { used: coachDaily, limit: coachLimits.daily, remaining: Math.max(0, coachLimits.daily - coachDaily) }, monthly: { used: coachMonthly, limit: coachLimits.monthly, remaining: Math.max(0, coachLimits.monthly - coachMonthly) } } };
}

export async function reserveAiUsage(ownerId: string, role: string, feature: AiUsageFeature, metadata?: Record<string, unknown>) {
  const provider = getAiProviderInfo();
  if (role !== 'admin') { const usage = await getUserAiUsage(ownerId); const featureUsage = feature === 'PLAN' ? usage.plan : usage.coach; const configured = limits(feature, usage.entitlement.plan); if (featureUsage.daily.used >= configured.daily || featureUsage.monthly.used >= configured.monthly) { await AiUsageModel.create({ ownerId, feature, status: 'REJECTED_QUOTA', provider: provider.provider, model: provider.model, completedAt: new Date(), metadata }); throw Object.assign(new Error(`${feature === 'PLAN' ? 'AI planner' : 'AI coach'} quota reached. Your allowance will reset automatically.`), { statusCode: 429, quota: featureUsage, entitlement: usage.entitlement, resetsAt: usage.resetsAt }); } }
  return AiUsageModel.create({ ownerId, feature, status: 'ACCEPTED', provider: provider.provider, model: provider.model, metadata });
}

export async function completeAiUsage(usageId: string, status: 'SUCCEEDED' | 'FAILED', input?: { jobId?: string; errorMessage?: string }) { await AiUsageModel.findByIdAndUpdate(usageId, { status, completedAt: new Date(), ...(input?.jobId ? { jobId: input.jobId } : {}), ...(input?.errorMessage ? { errorMessage: input.errorMessage.slice(0, 500) } : {}) }); }

export async function getAdminAiUsageOverview() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [totals, providers, failures, topUsers] = await Promise.all([
    AiUsageModel.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ['ACCEPTED', 'SUCCEEDED', 'FAILED'] } } }, { $group: { _id: { feature: '$feature', status: '$status' }, count: { $sum: 1 } } }]),
    AiUsageModel.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ['ACCEPTED', 'SUCCEEDED', 'FAILED'] } } }, { $group: { _id: { provider: '$provider', model: '$model' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AiUsageModel.find({ createdAt: { $gte: since }, status: 'FAILED' }).sort({ createdAt: -1 }).limit(10).select('feature provider model errorMessage createdAt ownerId').lean(),
    AiUsageModel.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ['ACCEPTED', 'SUCCEEDED', 'FAILED'] } } }, { $group: { _id: '$ownerId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }])
  ]);
  return { windowDays: 30, totals, providers, failures, topUsers };
}
