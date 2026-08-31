import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import { importPlan } from '../controllers/import.controller.js';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});
export const importRouter=Router();
importRouter.post('/learning-plans',requireAuth,upload.single('file'),importPlan);
