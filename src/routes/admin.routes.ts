import { Router } from 'express';
import { getAdminOverview } from '../controllers/admin.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/overview', getAdminOverview);
