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
  if (type === 'FEEDBACK') return 'New LearnFlow feedback';
  return 'New contact message';
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
    notificationError: 'Email delivery is disabled during phase one testing.'
  });

  const admins = await UserModel.find({ role: 'admin' }).select('_id').lean();
  if (!admins.length) {
    record.notificationError = 'Email delivery is disabled during phase one testing. No administrator account is configured for in-app notification.';
    await record.save();
    return record.toObject();
  }

  await NotificationModel.insertMany(admins.map(admin => ({
    ownerId: admin._id,
    type: 'SYSTEM',
    title: notificationTitle(input.type),
    message: `${input.name}: ${input.subject}`.slice(0, 240),
    actionUrl: input.type === 'SUPPORT' ? '/admin/support-requests' : '/notifications'
  })));

  record.notifiedAdminCount = admins.length;
  await record.save();
  return record.toObject();
}
