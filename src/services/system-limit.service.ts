import { SystemLimitModel, type SystemLimitCategory } from '../models/system-limit.model.js';

export const SYSTEM_LIMIT_KEYS = {
  AI_FREE_PLAN_DAILY: 'AI_FREE_PLAN_DAILY',
  AI_FREE_PLAN_MONTHLY: 'AI_FREE_PLAN_MONTHLY',
  AI_FREE_COACH_DAILY: 'AI_FREE_COACH_DAILY',
  AI_FREE_COACH_MONTHLY: 'AI_FREE_COACH_MONTHLY',
  AI_PRO_PLAN_DAILY: 'AI_PRO_PLAN_DAILY',
  AI_PRO_PLAN_MONTHLY: 'AI_PRO_PLAN_MONTHLY',
  AI_PRO_COACH_DAILY: 'AI_PRO_COACH_DAILY',
  AI_PRO_COACH_MONTHLY: 'AI_PRO_COACH_MONTHLY',
  YOUTUBE_SEARCH_GLOBAL_DAILY: 'YOUTUBE_SEARCH_GLOBAL_DAILY',
  YOUTUBE_SEARCH_USER_DAILY: 'YOUTUBE_SEARCH_USER_DAILY',
  YOUTUBE_SEARCH_USER_HOURLY: 'YOUTUBE_SEARCH_USER_HOURLY',
  ACCOUNT_MIN_REGISTRATION_AGE: 'ACCOUNT_MIN_REGISTRATION_AGE',
  YOUTUBE_MINOR_AGE_THRESHOLD: 'YOUTUBE_MINOR_AGE_THRESHOLD'
} as const;

export type SystemLimitKey = typeof SYSTEM_LIMIT_KEYS[keyof typeof SYSTEM_LIMIT_KEYS];

interface SeedLimit {
  key: SystemLimitKey;
  category: SystemLimitCategory;
  label: string;
  description: string;
  value: number;
  minValue: number;
  maxValue: number;
  unit: string;
}

export const DEFAULT_SYSTEM_LIMITS: SeedLimit[] = [
  { key: SYSTEM_LIMIT_KEYS.AI_FREE_PLAN_DAILY, category: 'AI', label: 'Free AI plans per day', description: 'Maximum AI learning-plan generations per Free user per UTC day.', value: 5, minValue: 1, maxValue: 1000, unit: 'requests/day' },
  { key: SYSTEM_LIMIT_KEYS.AI_FREE_PLAN_MONTHLY, category: 'AI', label: 'Free AI plans per month', description: 'Maximum AI learning-plan generations per Free user per UTC month.', value: 30, minValue: 1, maxValue: 10000, unit: 'requests/month' },
  { key: SYSTEM_LIMIT_KEYS.AI_FREE_COACH_DAILY, category: 'AI', label: 'Free AI coach requests per day', description: 'Maximum AI coach requests per Free user per UTC day.', value: 25, minValue: 1, maxValue: 5000, unit: 'requests/day' },
  { key: SYSTEM_LIMIT_KEYS.AI_FREE_COACH_MONTHLY, category: 'AI', label: 'Free AI coach requests per month', description: 'Maximum AI coach requests per Free user per UTC month.', value: 300, minValue: 1, maxValue: 50000, unit: 'requests/month' },
  { key: SYSTEM_LIMIT_KEYS.AI_PRO_PLAN_DAILY, category: 'AI', label: 'Pro AI plans per day', description: 'Maximum AI learning-plan generations per Pro user per UTC day.', value: 20, minValue: 1, maxValue: 1000, unit: 'requests/day' },
  { key: SYSTEM_LIMIT_KEYS.AI_PRO_PLAN_MONTHLY, category: 'AI', label: 'Pro AI plans per month', description: 'Maximum AI learning-plan generations per Pro user per UTC month.', value: 150, minValue: 1, maxValue: 10000, unit: 'requests/month' },
  { key: SYSTEM_LIMIT_KEYS.AI_PRO_COACH_DAILY, category: 'AI', label: 'Pro AI coach requests per day', description: 'Maximum AI coach requests per Pro user per UTC day.', value: 100, minValue: 1, maxValue: 5000, unit: 'requests/day' },
  { key: SYSTEM_LIMIT_KEYS.AI_PRO_COACH_MONTHLY, category: 'AI', label: 'Pro AI coach requests per month', description: 'Maximum AI coach requests per Pro user per UTC month.', value: 1500, minValue: 1, maxValue: 50000, unit: 'requests/month' },
  { key: SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_GLOBAL_DAILY, category: 'YOUTUBE', label: 'YouTube searches for the whole app per day', description: 'Maximum uncached YouTube search calls LearnFlow permits globally per rolling 24-hour window.', value: 80, minValue: 1, maxValue: 100000, unit: 'searches/day' },
  { key: SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_USER_DAILY, category: 'YOUTUBE', label: 'YouTube searches per user per day', description: 'Maximum uncached YouTube searches per learner per rolling 24-hour window.', value: 20, minValue: 1, maxValue: 10000, unit: 'searches/day' },
  { key: SYSTEM_LIMIT_KEYS.YOUTUBE_SEARCH_USER_HOURLY, category: 'YOUTUBE', label: 'YouTube searches per user per hour', description: 'Maximum uncached YouTube searches per learner per rolling hour.', value: 8, minValue: 1, maxValue: 1000, unit: 'searches/hour' },
  { key: SYSTEM_LIMIT_KEYS.ACCOUNT_MIN_REGISTRATION_AGE, category: 'ACCOUNT', label: 'Minimum registration age', description: 'Minimum age required to create a LearnFlow account.', value: 13, minValue: 13, maxValue: 18, unit: 'years' },
  { key: SYSTEM_LIMIT_KEYS.YOUTUBE_MINOR_AGE_THRESHOLD, category: 'ACCOUNT', label: 'YouTube minor threshold', description: 'Users younger than this age receive strict YouTube safety filtering and age-restricted videos are excluded.', value: 18, minValue: 14, maxValue: 21, unit: 'years' }
];

let cache: Map<string, number> | null = null;
let cacheExpiresAt = 0;
const CACHE_MS = 30_000;

export async function seedSystemLimits(): Promise<void> {
  await Promise.all(DEFAULT_SYSTEM_LIMITS.map(limit => SystemLimitModel.updateOne(
    { key: limit.key },
    { $setOnInsert: { ...limit, enabled: true } },
    { upsert: true }
  )));
  clearSystemLimitCache();
}

async function loadEnabledLimits(): Promise<Map<string, number>> {
  if (cache && cacheExpiresAt > Date.now()) return cache;
  const rows = await SystemLimitModel.find({ enabled: true }).select('key value').lean();
  cache = new Map(rows.map(row => [row.key, row.value]));
  cacheExpiresAt = Date.now() + CACHE_MS;
  return cache;
}

export async function getSystemLimit(key: SystemLimitKey): Promise<number> {
  const values = await loadEnabledLimits();
  const configured = values.get(key);
  if (typeof configured === 'number') return configured;
  const fallback = DEFAULT_SYSTEM_LIMITS.find(limit => limit.key === key);
  if (!fallback) throw new Error(`Unknown system limit: ${key}`);
  return fallback.value;
}

export async function getSystemLimits(keys: SystemLimitKey[]): Promise<Record<SystemLimitKey, number>> {
  const entries = await Promise.all(keys.map(async key => [key, await getSystemLimit(key)] as const));
  return Object.fromEntries(entries) as Record<SystemLimitKey, number>;
}

export async function listSystemLimits() {
  await seedSystemLimits();
  return SystemLimitModel.find().sort({ category: 1, key: 1 }).lean();
}

export async function updateSystemLimit(key: string, value: number, updatedBy: string) {
  const current = await SystemLimitModel.findOne({ key: key.toUpperCase() });
  if (!current) throw Object.assign(new Error('System limit not found'), { statusCode: 404 });
  if (!Number.isInteger(value) || value < current.minValue || value > current.maxValue) {
    throw Object.assign(new Error(`Value must be an integer between ${current.minValue} and ${current.maxValue}.`), { statusCode: 400 });
  }
  current.value = value;
  current.updatedBy = updatedBy as never;
  await current.save();
  clearSystemLimitCache();
  return current.toObject();
}

export function clearSystemLimitCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}

export function calculateAge(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}
