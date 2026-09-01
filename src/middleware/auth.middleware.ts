import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';

export interface AuthenticatedRequest extends Request { user?: { id: string; role: string }; }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub) return res.status(401).json({ message: 'Invalid token' });
    req.user = { id: payload.sub, role: String(payload.role ?? 'learner') };
    void UserModel.updateOne({ _id: payload.sub }, { $set: { lastSeenAt: new Date() } }).catch(error => console.error('Unable to update user presence', error));
    next();
  } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Authentication required' });
    const user = await UserModel.findById(req.user.id).select('role').lean();
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    const role = String(user.role ?? 'learner');
    req.user.role = role;
    if (role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    next();
  } catch (error) {
    next(error);
  }
}
