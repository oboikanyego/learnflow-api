import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { reminderWorker } from './services/reminder-worker.service.js';
import { startAiPlanWorker } from './services/ai-plan-queue.service.js';
import { billingGraceWorker } from './services/billing-grace-worker.service.js';

async function bootstrap() {
  await connectDatabase();
  reminderWorker.start();
  billingGraceWorker.start();
  startAiPlanWorker();
  app.listen(env.PORT, () => console.log(`LearnFlow API listening on :${env.PORT}`));
}

bootstrap().catch(error => {
  console.error('Startup failed', error);
  process.exit(1);
});
