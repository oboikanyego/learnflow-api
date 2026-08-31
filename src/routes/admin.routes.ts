import { Router } from 'express';
import { getAdminEntitlementHistory, getAdminOverview, listAdminUsers, updateAdminEntitlement } from '../controllers/admin.controller.js';
import { getAdminBillingSettings, patchAdminBillingSettings } from '../controllers/billing-settings.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/overview', getAdminOverview);
adminRouter.get('/users', listAdminUsers);
adminRouter.patch('/users/:id/entitlement', updateAdminEntitlement);
adminRouter.get('/users/:id/entitlement-history', getAdminEntitlementHistory);
adminRouter.get('/billing-settings', getAdminBillingSettings);
adminRouter.patch('/billing-settings', patchAdminBillingSettings);
