import { Types, connection } from 'mongoose';
import { AiUsageModel } from '../models/ai-usage.model.js';
import { UserManagementAuditModel } from '../models/user-management-audit.model.js';
import { UserModel } from '../models/user.model.js';
import { cloudinaryConfigured, deleteProfileImage } from './profile-image.service.js';
import { getSystemLimit, SYSTEM_LIMIT_KEYS } from './system-limit.service.js';

const ONLINE_WINDOW_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export async function enrichAdminUsers(users: any[]) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cleanupDays = await getSystemLimit(SYSTEM_LIMIT_KEYS.ACCOUNT_INACTIVE_CLEANUP_DAYS);
  const ids = users.map(user => new Types.ObjectId(String(user._id)));
  const usage = await AiUsageModel.aggregate([
    { $match: { ownerId: { $in: ids }, createdAt: { $gte: monthStart } } },
    { $group: {
      _id: '$ownerId',
      total: { $sum: 1 },
      succeeded: { $sum: { $cond: [{ $eq: ['$status', 'SUCCEEDED'] }, 1, 0] } },
      plans: { $sum: { $cond: [{ $eq: ['$feature', 'PLAN'] }, 1, 0] } },
      coach: { $sum: { $cond: [{ $eq: ['$feature', 'COACH'] }, 1, 0] } },
      rejectedQuota: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED_QUOTA'] }, 1, 0] } }
    } }
  ]);
  const usageMap = new Map(usage.map(row => [String(row._id), row]));

  return users.map(user => {
    const lastActivity = user.lastSeenAt ? new Date(user.lastSeenAt) : new Date(user.createdAt);
    const inactivityDays = Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS));
    const isOnline = Boolean(user.lastSeenAt && now.getTime() - new Date(user.lastSeenAt).getTime() <= ONLINE_WINDOW_MS);
    const entitlement = user.entitlement ?? {};
    const startsAt = entitlement.startsAt ? new Date(entitlement.startsAt) : null;
    const endsAt = entitlement.endsAt ? new Date(entitlement.endsAt) : null;
    const durationDays = startsAt && endsAt ? Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / DAY_MS)) : null;
    const daysRemaining = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)) : null;
    const subscriptionProgressPercent = startsAt && endsAt
      ? Math.max(0, Math.min(100, Math.round(((now.getTime() - startsAt.getTime()) / (endsAt.getTime() - startsAt.getTime())) * 100)))
      : null;
    const row = usageMap.get(String(user._id)) ?? { total: 0, succeeded: 0, plans: 0, coach: 0, rejectedQuota: 0 };
    return {
      ...user,
      presence: { isOnline, lastSeenAt: user.lastSeenAt ?? null },
      inactivity: { days: inactivityDays, cleanupThresholdDays: cleanupDays, eligible: user.role !== 'admin' && inactivityDays >= cleanupDays },
      aiUsage: { month: { total: row.total, succeeded: row.succeeded, plans: row.plans, coach: row.coach, rejectedQuota: row.rejectedQuota } },
      subscription: { durationDays, daysRemaining, progressPercent: subscriptionProgressPercent }
    };
  });
}

export async function deleteInactiveUserAccount(input: { targetUserId: string; performedBy: string; reason: string }) {
  if (input.targetUserId === input.performedBy) throw Object.assign(new Error('You cannot delete your own admin account.'), { statusCode: 400 });
  const cleanupDays = await getSystemLimit(SYSTEM_LIMIT_KEYS.ACCOUNT_INACTIVE_CLEANUP_DAYS);
  const user = await UserModel.findById(input.targetUserId).select('+profileImagePublicId role createdAt lastSeenAt').lean();
  if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  if (user.role === 'admin') throw Object.assign(new Error('Administrator accounts cannot be removed through inactivity cleanup.'), { statusCode: 400 });

  const now = Date.now();
  const lastActivity = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : new Date(user.createdAt).getTime();
  const inactivityDays = Math.max(0, Math.floor((now - lastActivity) / DAY_MS));
  if (inactivityDays < cleanupDays) {
    throw Object.assign(new Error(`This account is not eligible for cleanup until it has been inactive for ${cleanupDays} days.`), { statusCode: 409 });
  }

  if (user.profileImagePublicId && cloudinaryConfigured()) {
    try { await deleteProfileImage(String(user.profileImagePublicId)); } catch (error) { console.warn('Unable to delete profile image during account cleanup', error); }
  }

  const userId = new Types.ObjectId(input.targetUserId);
  const db = connection.db;
  if (!db) throw Object.assign(new Error('Database is unavailable.'), { statusCode: 503 });
  const excluded = new Set(['users','systemlimits','systemlimitaudits','usermanagementaudits','billingsettings','billingsettingsaudits']);
  const collections = await db.collections();
  let deletedRecords = 0;
  for (const collection of collections) {
    if (excluded.has(collection.collectionName)) continue;
    const result = await collection.deleteMany({ $or: [{ ownerId: userId }, { userId }, { createdBy: userId }] });
    deletedRecords += result.deletedCount;
    await collection.updateMany({ members: userId }, { $pull: { members: userId } } as any).catch(() => undefined);
  }

  await UserModel.deleteOne({ _id: userId });
  await UserManagementAuditModel.create({
    targetUserId: userId,
    action: 'ACCOUNT_DELETED',
    performedBy: new Types.ObjectId(input.performedBy),
    reason: input.reason,
    inactivityDays,
    cleanupThresholdDays: cleanupDays,
    metadata: { deletedRecords }
  });
  return { message: 'Inactive account and owned application data were cleared.', deletedRecords, inactivityDays, cleanupThresholdDays: cleanupDays };
}
