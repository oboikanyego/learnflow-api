import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { reminderWorker } from './services/reminder-worker.service.js';
import { aiPlanCleanupWorker } from './services/ai-plan-cleanup-worker.service.js';
import { startAiPlanWorker } from './services/ai-plan-queue.service.js';
import { billingGraceWorker } from './services/billing-grace-worker.service.js';
import { weeklyReviewWorker } from './services/weekly-review-worker.service.js';
import { seedSystemLimits } from './services/system-limit.service.js';
import { cleanupOrphanedLearningData } from './services/data-integrity.service.js';

async function bootstrap() {
  await connectDatabase();
  await seedSystemLimits();
  const cleaned = await cleanupOrphanedLearningData();
  if (cleaned.phases || cleaned.modules || cleaned.lessons || cleaned.studySessions || cleaned.lessonComments) {
    console.log(`[data-integrity] Removed orphaned learning data: ${cleaned.phases} phases, ${cleaned.modules} modules, ${cleaned.lessons} lessons, ${cleaned.studySessions} study sessions, ${cleaned.lessonComments} lesson comments.`);
  }
  reminderWorker.start();
  billingGraceWorker.start();
  weeklyReviewWorker.start();
  aiPlanCleanupWorker.start();
  startAiPlanWorker();
  app.listen(env.PORT, () => console.log(`LearnFlow API listening on :${env.PORT}`));
}

bootstrap().catch(error => {
  console.error('Startup failed', error);
  process.exit(1);
});
