import { Queue, Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { env } from '../config/env.js';
import { markAiPlanJobPermanentlyFailed, processAiPlanJob, type PlanInput } from './ai-plan-processor.service.js';
import { createRedisConnection, redisConfigured } from './redis.service.js';

const QUEUE_NAME = 'learnflow-ai-plan-generation';

export interface AiPlanQueueData {
  appJobId: string;
  ownerId: string;
  timezone: string;
  input: PlanInput;
  usageId?: string;
}

let producerConnection: IORedis | undefined;
let workerConnection: IORedis | undefined;
let queue: Queue<AiPlanQueueData> | undefined;
let worker: Worker<AiPlanQueueData> | undefined;

function getQueue(): Queue<AiPlanQueueData> {
  if (!redisConfigured()) throw Object.assign(new Error('Background job queue is not configured. Set REDIS_URL on the API service.'), { statusCode: 503 });
  if (!producerConnection) producerConnection = createRedisConnection({ maxRetriesPerRequest: 1 });
  if (!queue) {
    queue = new Queue<AiPlanQueueData>(QUEUE_NAME, {
      connection: producerConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 }
      }
    });
  }
  return queue;
}

export async function enqueueAiPlanJob(data: AiPlanQueueData): Promise<void> {
  await getQueue().add('generate-plan', data, { jobId: `ai-plan-${data.appJobId}` });
}

export function startAiPlanWorker(): void {
  if (!redisConfigured() || worker) return;
  workerConnection = createRedisConnection({ maxRetriesPerRequest: null });
  worker = new Worker<AiPlanQueueData>(QUEUE_NAME, async (job: Job<AiPlanQueueData>) => {
    const { appJobId, ownerId, timezone, input, usageId } = job.data;
    await processAiPlanJob(appJobId, ownerId, timezone, input, usageId);
  }, { connection: workerConnection, concurrency: env.AI_QUEUE_CONCURRENCY });

  worker.on('completed', job => console.log(`AI plan queue completed ${job.id}`));
  worker.on('failed', (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    console.error(`AI plan queue failed ${job.id} attempt ${job.attemptsMade}/${maxAttempts}`, error.message);
    if (job.attemptsMade >= maxAttempts) {
      const { appJobId, ownerId, usageId } = job.data;
      void markAiPlanJobPermanentlyFailed(appJobId, ownerId, error, usageId).catch(markError => console.error('Could not persist permanent AI plan job failure', markError));
    }
  });
  worker.on('error', error => console.error('AI plan queue worker error', error));
  console.log(`AI plan BullMQ worker started with concurrency ${env.AI_QUEUE_CONCURRENCY}`);
}

export async function getAiPlanQueueHealth() {
  if (!redisConfigured()) return { configured: false, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
  try {
    const counts = await getQueue().getJobCounts('wait', 'active', 'delayed', 'failed', 'completed');
    return { configured: true, waiting: counts.wait ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0, failed: counts.failed ?? 0, completed: counts.completed ?? 0 };
  } catch (error) {
    return { configured: true, unavailable: true, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0, error: error instanceof Error ? error.message.slice(0, 200) : 'Redis queue unavailable' };
  }
}

export async function closeAiPlanQueue(): Promise<void> {
  await worker?.close(); await queue?.close(); await workerConnection?.quit(); await producerConnection?.quit();
  worker = undefined; queue = undefined; workerConnection = undefined; producerConnection = undefined;
}
