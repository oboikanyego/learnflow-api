import { UserModel, type Entitlement, type EntitlementPlan, type EntitlementStatus } from '../models/user.model.js';
import { EntitlementAuditModel } from '../models/entitlement-audit.model.js';

export function normalizeEntitlement(entitlement?: Partial<Entitlement> | null): Entitlement {
  return {
    plan: entitlement?.plan ?? 'FREE',
    status: entitlement?.status ?? 'ACTIVE',
    source: entitlement?.source ?? 'SYSTEM',
    startsAt: entitlement?.startsAt,
    endsAt: entitlement?.endsAt
  };
}

export function entitlementCapabilities(entitlement?: Partial<Entitlement> | null) {
  const current = normalizeEntitlement(entitlement);
  const active = current.status === 'ACTIVE' || current.status === 'GRACE';
  const pro = active && current.plan === 'PRO';
  return {
    plan: current.plan,
    status: current.status,
    canUseAiPlanner: active,
    canUseAiCoach: active,
    advancedAnalytics: pro,
    priorityAiQueue: pro,
    weeklyProgressEmail: pro,
    whatsappNotifications: false
  };
}

export async function changeUserEntitlement(input: {
  userId: string;
  changedBy: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  reason?: string;
  startsAt?: Date;
  endsAt?: Date;
}) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const previous = normalizeEntitlement(user.entitlement);
  const next: Entitlement = {
    plan: input.plan,
    status: input.status,
    source: 'ADMIN',
    startsAt: input.startsAt ?? new Date(),
    endsAt: input.endsAt
  };

  user.entitlement = next;
  await user.save();
  await EntitlementAuditModel.create({
    userId: user._id,
    changedBy: input.changedBy,
    previousPlan: previous.plan,
    newPlan: next.plan,
    previousStatus: previous.status,
    newStatus: next.status,
    source: 'ADMIN',
    reason: input.reason,
    startsAt: next.startsAt,
    endsAt: next.endsAt
  });

  return { userId: user.id, entitlement: normalizeEntitlement(user.entitlement), capabilities: entitlementCapabilities(user.entitlement) };
}

export async function listEntitlementHistory(userId: string) {
  return EntitlementAuditModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('changedBy', 'name email')
    .lean();
}
