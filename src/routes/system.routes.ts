import { Router } from 'express';import { runReminderCycle } from '../controllers/system.controller.js';export const systemRouter=Router();systemRouter.post('/run-reminders',runReminderCycle);
