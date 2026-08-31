import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request { user?: { id: string; role: string }; }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub) return res.status(401).json({ message: 'Invalid token' });
    req.user = { id: payload.sub, role: String(payload.role ?? 'learner') };
    next();
  } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}
