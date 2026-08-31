import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { UserModel, type NotificationPreferences } from '../models/user.model.js';
import { emailService } from './email.service.js';
import { passwordResetEmail } from '../templates/email-templates.js';

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';
const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppReminders: true,
  emailReminders: true,
  reminderMinutes: 30,
  missedSessionEmails: true,
  celebrationEmails: true
};

export class AuthService {
  async register(input: { name: string; email: string; password: string; timezone: string }) {
    if (await userRepository.findByEmail(input.email)) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({ name: input.name, email: input.email, passwordHash, timezone: input.timezone });
    return this.toAuthResponse(user.id, user.name, user.email, user.role, user.timezone);
  }

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email, true);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    return this.toAuthResponse(user.id, user.name, user.email, user.role, user.timezone);
  }

  async me(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      notificationPreferences: { ...DEFAULT_PREFERENCES, ...(user.notificationPreferences ?? {}) }
    };
  }

  async updateNotificationPreferences(userId: string, input: NotificationPreferences) {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: { notificationPreferences: input } }, { new: true }).lean();
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return { notificationPreferences: { ...DEFAULT_PREFERENCES, ...(user.notificationPreferences ?? {}) } };
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return { message: GENERIC_RESET_MESSAGE };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await UserModel.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } });

    const resetUrl = `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    if (env.RESEND_API_KEY) await emailService.sendTemplate(user.email, passwordResetEmail(user.name, resetUrl));

    return {
      message: GENERIC_RESET_MESSAGE,
      ...(env.NODE_ENV !== 'production' && !env.RESEND_API_KEY ? { resetUrl } : {})
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

    if (!user) throw Object.assign(new Error('This password reset link is invalid or has expired.'), { statusCode: 400 });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    return { message: 'Password updated successfully. You can now sign in with your new password.' };
  }

  private toAuthResponse(id: string, name: string, email: string, role: string, timezone: string) {
    const token = jwt.sign({ sub: id, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return { token, user: { id, name, email, role, timezone } };
  }
}

export const authService = new AuthService();
