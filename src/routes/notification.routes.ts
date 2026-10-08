import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listNotifications,markNotificationRead,markAllNotificationsRead } from '../controllers/notification.controller.js';
export const notificationRouter=Router();
notificationRouter.use(requireAuth);
notificationRouter.get('/',listNotifications);
notificationRouter.patch('/read-all',markAllNotificationsRead);
notificationRouter.patch('/:id/read',markNotificationRead);
