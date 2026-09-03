import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { adminRouter } from './routes/admin.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { assessmentRouter } from './routes/assessment.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { careerOutcomeRouter } from './routes/career-outcome.routes.js';
import { careerRouter } from './routes/career.routes.js';
import { hierarchyRouter } from './routes/hierarchy.routes.js';
import { importRouter } from './routes/import.routes.js';
import { intelligenceRouter } from './routes/intelligence.routes.js';
import { jobApplicationRouter } from './routes/job-application.routes.js';
import { jobIntelligenceRouter } from './routes/job-intelligence.routes.js';
import { learningGoalRouter } from './routes/learning-goal.routes.js';
import { learningPathRouter } from './routes/learning-path.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { retentionRouter } from './routes/retention.routes.js';
import { publicProgressRouter, shareProgressRouter } from './routes/share-progress.routes.js';
import { socialRouter } from './routes/social.routes.js';
import { studySessionRouter } from './routes/study-session.routes.js';
import { systemRouter } from './routes/system.routes.js';
import { pingRedis } from './services/redis.service.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'learnflow-api' }));
app.get('/health/redis', async (_req, res) => {
  const redis = await pingRedis();
  const status = redis.available ? 'UP' : redis.configured ? 'DOWN' : 'NOT_CONFIGURED';
  res.status(redis.available ? 200 : 503).json({
    status,
    configured: redis.configured,
    latencyMs: redis.latencyMs ?? null
  });
});

app.use('/api/v1/public/progress', publicProgressRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/onboarding', onboardingRouter);
app.use('/api/v1/share-progress', shareProgressRouter);
app.use('/api/v1/study-sessions', studySessionRouter);
app.use('/api/v1/retention', retentionRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/assessments', assessmentRouter);
app.use('/api/v1/career/jobs', jobIntelligenceRouter);
app.use('/api/v1/career/applications', jobApplicationRouter);
app.use('/api/v1/career/outcomes', careerOutcomeRouter);
app.use('/api/v1/career', careerRouter);
app.use('/api/v1/learning-paths', learningPathRouter);
app.use('/api/v1/goals', learningGoalRouter);
app.use('/api/v1/intelligence', intelligenceRouter);
app.use('/api/v1', hierarchyRouter);
app.use('/api/v1/imports', importRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/system', systemRouter);
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);
