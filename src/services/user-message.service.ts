import { Types } from 'mongoose';
import { NotificationModel } from '../models/notification.model.js';
import { UserMessageModel, type UserMessageType } from '../models/user-message.model.js';
import { UserModel } from '../models/user.model.js';
import { emailService } from './email.service.js';

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

function buildAdminEmail(input: CreateUserMessageInput): { subject: string; text: string } {
  const lines = [
    `LearnFlow ${input.type.toLowerCase()} received`,
    '',
    `From: ${input.name} <${input.email}>`,
    `Subject: ${input.subject}`,
    ...(input.rating ? [`Rating: ${input.rating}/5`] : []),
    ...(input.category ? [`Category: ${input.category}`] : []),
    '',
    input.message
  ];
  return { subject: `[LearnFlow ${input.type}] ${input.subject}`, text: lines.join('\n') };
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
    ...(input.category ? { category: input.category } : {})
  });

  const admins = await UserModel.find({ role: 'admin' }).select('_id email').lean();
  if (!admins.length) {
    record.notificationStatus = 'SKIPPED';
    record.notificationError = 'No administrator account is configured.';
    await record.save();
    return record.toObject();
  }

  await NotificationModel.insertMany(admins.map(admin => ({
    ownerId: admin._id,
    type: 'SYSTEM',
    title: notificationTitle(input.type),
    message: `${input.name}: ${input.subject}`.slice(0, 240)
  })));

  const email = buildAdminEmail(input);
  const results = await Promise.all(admins.map(admin => emailService.send({ to: admin.email, ...email })));
  const sent = results.filter(result => result.status === 'SENT');
  const failed = results.filter(result => result.status === 'FAILED');
  const skipped = results.filter(result => result.status === 'SKIPPED');

  record.notifiedAdminCount = sent.length;
  record.providerMessageIds = sent.flatMap(result => result.providerMessageId ? [result.providerMessageId] : []);
  record.notificationStatus = sent.length === results.length ? 'SENT' : sent.length > 0 ? 'PARTIAL' : failed.length > 0 ? 'FAILED' : 'SKIPPED';
  const errors = [...failed, ...skipped].flatMap(result => result.errorMessage ? [result.errorMessage] : []);
  if (errors.length) record.notificationError = errors.join(' | ').slice(0, 1000);
  await record.save();
  return record.toObject();
}
