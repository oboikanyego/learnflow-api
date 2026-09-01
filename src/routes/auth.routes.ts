import { Router } from 'express';
import { changePassword, forgotPassword, login, me, register, resetPassword, testEmail, updateNotificationPreferences, updateProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const authRouter = Router();
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.get('/me', requireAuth, me);
authRouter.patch('/profile', requireAuth, updateProfile);
authRouter.post('/change-password', requireAuth, changePassword);
authRouter.patch('/notification-preferences', requireAuth, updateNotificationPreferences);
authRouter.post('/test-email', requireAuth, testEmail);
