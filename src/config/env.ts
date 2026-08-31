import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGIN: z.string().default('http://localhost:4200'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.6-luna'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('LearnFlow <onboarding@resend.dev>'),
  REMINDER_CRON_SECRET: z.string().min(24).optional()
});
export const env = schema.parse(process.env);
