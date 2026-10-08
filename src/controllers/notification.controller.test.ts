import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

vi.mock('../models/notification.model.js', () => ({
  NotificationModel: { find: vi.fn(), findOneAndUpdate: vi.fn(), updateMany: vi.fn() }
}));

import { markAllNotificationsRead, markNotificationRead } from './notification.controller.js';
import { NotificationModel } from '../models/notification.model.js';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { user: { id: 'user-1', role: 'learner' }, params: {}, ...overrides } as AuthenticatedRequest;
}

describe('markAllNotificationsRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only marks the current user\'s unread notifications as read', async () => {
    vi.mocked(NotificationModel.updateMany).mockResolvedValue({ modifiedCount: 3 } as never);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await markAllNotificationsRead(req, res, next);

    expect(NotificationModel.updateMany).toHaveBeenCalledWith(
      { ownerId: 'user-1', readAt: { $exists: false } },
      { readAt: expect.any(Date) }
    );
    expect(res.json).toHaveBeenCalledWith({ modifiedCount: 3 });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next() instead of throwing', async () => {
    const error = new Error('db down');
    vi.mocked(NotificationModel.updateMany).mockRejectedValue(error);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await markAllNotificationsRead(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('markNotificationRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the update to the notification id and owner', async () => {
    const updated = { _id: 'n1', ownerId: 'user-1', readAt: new Date() };
    vi.mocked(NotificationModel.findOneAndUpdate).mockResolvedValue(updated as never);
    const req = mockReq({ params: { id: 'n1' } });
    const res = mockRes();
    const next = vi.fn();

    await markNotificationRead(req, res, next);

    expect(NotificationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'n1', ownerId: 'user-1' },
      { readAt: expect.any(Date) },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when the notification does not belong to this user (or does not exist)', async () => {
    vi.mocked(NotificationModel.findOneAndUpdate).mockResolvedValue(null as never);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    const next = vi.fn();

    await markNotificationRead(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Notification not found' });
  });
});
