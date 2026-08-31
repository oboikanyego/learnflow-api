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

export async function applyEntitlementChange(input: {
  userId: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: 'ADMIN' | 'BILLING' | 'SYSTEM';
  changedBy?: string;
  reason?: string;
  provider?: string;
  providerEventId?: string;
  startsAt?: Date;
  endsAt?: Date;
}) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (input.providerEventId) {
    const duplicate = await EntitlementAuditModel.exists({ provider: input.provider, providerEventId: input.providerEventId });
    if (duplicate) return { userId: user.id, entitlement: normalizeEntitlement(user.entitlement), capabilities: entitlementCapabilities(user.entitlement), duplicate: true };
  }

  const previous = normalizeEntitlement(user.entitlement);
  const next: Entitlement = {
    plan: input.plan,
    status: input.status,
    source: input.source,
    startsAt: input.startsAt ?? new Date(),
    endsAt: input.endsAt
  };

  user.entitlement = next;
  await user.save();
  await EntitlementAuditModel.create({
    userId: user._id,
    ...(input.changedBy ? { changedBy: input.changedBy } : {}),
    actorType: input.source,
    previousPlan: previous.plan,
    newPlan: next.plan,
    previousStatus: previous.status,
    newStatus: next.status,
    source: input.source,
    reason: input.reason,
    provider: input.provider,
    providerEventId: input.providerEventId,
    startsAt: next.startsAt,
    endsAt: next.endsAt
  });

  return { userId: user.id, entitlement: normalizeEntitlement(user.entitlement), capabilities: entitlementCapabilities(user.entitlement), duplicate: false };
}

export async function expireGraceEntitlement(input: {
  userId: string;
  provider?: string;
  providerEventId: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const previousUser = await UserModel.findOneAndUpdate(
    {
      _id: input.userId,
      'entitlement.plan': 'PRO',
      'entitlement.status': 'GRACE',
      'entitlement.endsAt': { $lte: now }
    },
    {
      $set: {
        entitlement: {
          plan: 'FREE',
          status: 'ACTIVE',
          source: 'SYSTEM',
          startsAt: now
        }
      }
    },
    { new: false }
  );

  if (!previousUser) return { expired: false };

  const previous = normalizeEntitlement(previousUser.entitlement);
  try {
    await EntitlementAuditModel.create({
      userId: previousUser._id,
      actorType: 'SYSTEM',
      previousPlan: previous.plan,
      newPlan: 'FREE',
      previousStatus: previous.status,
      newStatus: 'ACTIVE',
      source: 'SYSTEM',
      reason: input.reason,
      provider: input.provider,
      providerEventId: input.providerEventId,
      startsAt: now
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }

  return { expired: true };
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
  return applyEntitlementChange({ ...input, source: 'ADMIN' });
}

export async function listEntitlementHistory(userId: string) {
  return EntitlementAuditModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('changedBy', 'name email')
    .lean();
}
