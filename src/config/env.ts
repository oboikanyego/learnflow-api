import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGIN: z.string().default('http://localhost:4200'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().url().optional(),
  CLOUDINARY_URL: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  AI_QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  AI_PROVIDER: z.enum(['openai', 'groq', 'gemini']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.6-luna'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.7-flash'),
  AI_PLAN_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
  AI_PLAN_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(10000).default(30),
  AI_COACH_DAILY_LIMIT: z.coerce.number().int().min(1).max(5000).default(25),
  AI_COACH_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(50000).default(300),
  PRO_AI_PLAN_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
  PRO_AI_PLAN_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(10000).default(150),
  PRO_AI_COACH_DAILY_LIMIT: z.coerce.number().int().min(1).max(5000).default(100),
  PRO_AI_COACH_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(50000).default(1500),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('LearnFlow <onboarding@resend.dev>'),
  REMINDER_CRON_SECRET: z.string().min(24).optional(),
  BILLING_API_KEY: z.string().optional(),
  BILLING_WEBHOOK_SECRET: z.string().optional()
});
export const env = schema.parse(process.env);
