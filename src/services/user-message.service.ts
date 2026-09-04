import { Types } from 'mongoose';
import { NotificationModel } from '../models/notification.model.js';
import { UserMessageModel, type UserMessageType } from '../models/user-message.model.js';
import { UserModel } from '../models/user.model.js';

interface CreateUserMessageInput {
  type: UserMessageType;
  userId?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  rating?: number;
  category?: string;
}

function notificationTitle(type: UserMessageType): string {
  if (type === 'SUPPORT') return 'New support request';
  if (type === 'FEEDBACK') return 'New feedback request';
  return 'New contact request';
}

export async function createUserMessage(input: CreateUserMessageInput) {
  const record = await UserMessageModel.create({
    type: input.type,
    ...(input.userId ? { user: new Types.ObjectId(input.userId) } : {}),
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    ...(input.rating ? { rating: input.rating } : {}),
    ...(input.category ? { category: input.category } : {}),
    notificationStatus: 'SKIPPED',
    notificationError: 'Outbound communications are disabled for Contact, Feedback and Support during the pre-revenue testing phase.'
  });

  const admins = await UserModel.find({ role: 'admin' }).select('_id').lean();
  if (!admins.length) {
    record.notificationError = 'Outbound communications are disabled for Contact, Feedback and Support during the pre-revenue testing phase. No administrator account is configured for in-app notification.';
    await record.save();
    return record.toObject();
  }

  await NotificationModel.insertMany(admins.map(admin => ({
    ownerId: admin._id,
    type: 'SYSTEM',
    title: notificationTitle(input.type),
    message: `${input.name}: ${input.subject}`.slice(0, 240),
    actionUrl: '/admin/support-requests'
  })));

  record.notifiedAdminCount = admins.length;
  await record.save();
  return record.toObject();
}
