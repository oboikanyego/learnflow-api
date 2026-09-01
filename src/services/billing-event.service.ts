import { BillingEventModel, type BillingEventStatus } from '../models/billing-event.model.js';
import type { BillingProvider } from '../models/subscription.model.js';

interface RegisterBillingEventInput {
  provider: Exclude<BillingProvider, 'UNCONFIGURED'>;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  metadata?: Record<string, unknown>;
}

export type BillingEventRegistration =
  | { action: 'PROCESS'; eventId: string; retry: boolean }
  | { action: 'DUPLICATE'; eventId: string; status: Extract<BillingEventStatus, 'PROCESSED' | 'IGNORED'> }
  | { action: 'IN_PROGRESS'; eventId: string };

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}

export async function registerBillingEvent(input: RegisterBillingEventInput): Promise<BillingEventRegistration> {
  try {
    const event = await BillingEventModel.create({
      provider: input.provider,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      payloadHash: input.payloadHash,
      metadata: input.metadata,
      status: 'RECEIVED',
      attempts: 1,
      receivedAt: new Date()
    });
    return { action: 'PROCESS', eventId: String(event._id), retry: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const existing = await BillingEventModel.findOne({
    provider: input.provider,
    providerEventId: input.providerEventId
  }).select('_id status').lean();

  if (!existing) throw new Error('Billing event duplicate was detected but could not be loaded.');
  const eventId = String(existing._id);

  if (existing.status === 'PROCESSED' || existing.status === 'IGNORED') {
    return { action: 'DUPLICATE', eventId, status: existing.status };
  }

  if (existing.status === 'RECEIVED') {
    return { action: 'IN_PROGRESS', eventId };
  }

  const reclaimed = await BillingEventModel.findOneAndUpdate(
    { _id: existing._id, status: 'FAILED' },
    {
      $set: {
        status: 'RECEIVED',
        error: undefined,
        processedAt: undefined,
        receivedAt: new Date(),
        eventType: input.eventType,
        payloadHash: input.payloadHash,
        metadata: input.metadata
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  ).lean();

  if (!reclaimed) return { action: 'IN_PROGRESS', eventId };
  return { action: 'PROCESS', eventId, retry: true };
}

export async function markBillingEventProcessed(eventId: string, userId: string, metadata?: Record<string, unknown>) {
  await BillingEventModel.updateOne(
    { _id: eventId },
    {
      $set: {
        status: 'PROCESSED',
        userId,
        processedAt: new Date(),
        error: undefined,
        ...(metadata ? { metadata } : {})
      }
    }
  );
}

export async function markBillingEventIgnored(eventId: string, metadata?: Record<string, unknown>) {
  await BillingEventModel.updateOne(
    { _id: eventId },
    {
      $set: {
        status: 'IGNORED',
        processedAt: new Date(),
        error: undefined,
        ...(metadata ? { metadata } : {})
      }
    }
  );
}

export async function markBillingEventFailed(eventId: string, error: unknown, userId?: string) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown billing event processing error');
  await BillingEventModel.updateOne(
    { _id: eventId },
    {
      $set: {
        status: 'FAILED',
        ...(userId ? { userId } : {}),
        error: message.slice(0, 1000),
        processedAt: new Date()
      }
    }
  );
}
