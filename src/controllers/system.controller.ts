import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { reminderWorker } from '../services/reminder-worker.service.js';
export async function runReminderCycle(req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.REMINDER_CRON_SECRET || req.headers['x-cron-secret'] !== env.REMINDER_CRON_SECRET) return res.status(401).json({ message: 'Invalid cron credentials' });
    res.json(await reminderWorker.runOnce());
  } catch (error) { next(error); }
}
