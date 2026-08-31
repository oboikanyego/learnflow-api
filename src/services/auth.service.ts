import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';

export class AuthService {
  async register(input: { name: string; email: string; password: string }) {
    if (await userRepository.findByEmail(input.email)) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({ name: input.name, email: input.email, passwordHash });
    return this.toAuthResponse(user.id, user.name, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email, true);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    return this.toAuthResponse(user.id, user.name, user.email, user.role);
  }

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  private toAuthResponse(id: string, name: string, email: string, role: string) {
    const token = jwt.sign({ sub: id, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return { token, user: { id, name, email, role } };
  }
}

export const authService = new AuthService();
