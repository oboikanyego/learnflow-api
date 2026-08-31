import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { UserModel } from '../models/user.model.js';
import { brandedEmail } from './email-template.service.js';
import { emailService } from './email.service.js';

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

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
    const user = await userRepository.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return { id: user.id, name: user.name, email: user.email, role: user.role, timezone: user.timezone };
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return { message: GENERIC_RESET_MESSAGE };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await UserModel.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } });

    const resetUrl = `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    if (env.RESEND_API_KEY) await this.sendResetEmail(user.email, user.name, resetUrl);

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

  private async sendResetEmail(email: string, name: string, resetUrl: string) {
    const content = brandedEmail({
      preheader: 'Reset your LearnFlow password securely',
      eyebrow: 'Account security',
      title: 'Reset your LearnFlow password',
      greeting: name,
      body: [
        'We received a request to reset the password for your LearnFlow account.',
        'Use the secure button below to choose a new password. The link expires after 30 minutes.'
      ],
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
      note: 'If you did not request this password reset, you can safely ignore this email. Your existing password will remain unchanged.'
    });
    await emailService.send({ to: email, subject: 'Reset your LearnFlow password', ...content });
  }

  private toAuthResponse(id: string, name: string, email: string, role: string, timezone: string) {
    const token = jwt.sign({ sub: id, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return { token, user: { id, name, email, role, timezone } };
  }
}

export const authService = new AuthService();
