import { Router } from 'express';
import multer from 'multer';
import { changePassword, forgotPassword, login, me, register, resetPassword, testEmail, updateNotificationPreferences, updateProfile } from '../controllers/auth.controller.js';
import { removeProfileImageController, uploadProfileImageController } from '../controllers/profile-image.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!PROFILE_IMAGE_TYPES.has(file.mimetype)) {
      return callback(Object.assign(new Error('Profile pictures must be JPG, PNG or WebP images.'), { statusCode: 400 }));
    }
    callback(null, true);
  }
});

export const authRouter = Router();
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.get('/me', requireAuth, me);
authRouter.patch('/profile', requireAuth, updateProfile);
authRouter.post('/profile-image', requireAuth, profileImageUpload.single('file'), uploadProfileImageController);
authRouter.delete('/profile-image', requireAuth, removeProfileImageController);
authRouter.post('/change-password', requireAuth, changePassword);
authRouter.patch('/notification-preferences', requireAuth, updateNotificationPreferences);
authRouter.post('/test-email', requireAuth, testEmail);
