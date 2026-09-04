import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserMessageModel } from '../models/user-message.model.js';

const querySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  category: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

const statusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
  resolutionNote: z.string().trim().max(1000).optional()
});

export async function listSupportRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = querySchema.parse(req.query);
    const filter: Record<string, unknown> = { type: 'SUPPORT' };
    if (input.status) filter.status = input.status;
    if (input.category) filter.category = input.category;
    if (input.q) {
      const regex = new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { subject: regex }, { message: regex }];
    }

    const [items, total] = await Promise.all([
      UserMessageModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .lean(),
      UserMessageModel.countDocuments(filter)
    ]);

    const counts = await UserMessageModel.aggregate([
      { $match: { type: 'SUPPORT' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      counts: Object.fromEntries(counts.map(item => [item._id, item.count]))
    });
  } catch (error) { next(error); }
}

export async function updateSupportRequestStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid support request id.' });
    const input = statusSchema.parse(req.body);
    const record = await UserMessageModel.findOne({ _id: req.params.id, type: 'SUPPORT' });
    if (!record) return res.status(404).json({ message: 'Support request not found.' });

    const wasResolved = record.status === 'RESOLVED';
    record.status = input.status;
    if (input.status === 'RESOLVED') {
      record.resolvedAt = new Date();
      record.resolvedBy = new Types.ObjectId(req.user!.id);
      record.resolutionNote = input.resolutionNote;
    } else {
      record.resolvedAt = undefined;
      record.resolvedBy = undefined;
      record.resolutionNote = undefined;
    }
    await record.save();

    if (input.status === 'RESOLVED' && !wasResolved && record.user) {
      await NotificationModel.create({
        ownerId: record.user,
        type: 'SYSTEM',
        title: 'Support request resolved',
        message: `Your support request “${record.subject}” has been resolved.${input.resolutionNote ? ` ${input.resolutionNote}` : ''}`.slice(0, 500),
        actionUrl: '/support'
      });
    }

    res.json({ message: `Support request marked ${input.status.toLowerCase().replace('_', ' ')}.`, item: record.toObject() });
  } catch (error) { next(error); }
}
