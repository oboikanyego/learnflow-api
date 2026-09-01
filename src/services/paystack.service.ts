import crypto from 'node:crypto';
import { env } from '../config/env.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function secretKey() {
  if (!env.BILLING_API_KEY) throw Object.assign(new Error('Paystack secret key is not configured.'), { statusCode: 503, exposeMessage: true });
  return env.BILLING_API_KEY;
}

async function paystackRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const body = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: T } | null;
  if (!response.ok || !body?.status) {
    throw Object.assign(
      new Error(body?.message ?? `Paystack request failed with HTTP ${response.status}.`),
      { statusCode: 502, exposeMessage: true }
    );
  }
  return body.data as T;
}

export async function initializePaystackSubscriptionCheckout(input: {
  email: string;
  userId: string;
  interval: 'MONTHLY' | 'YEARLY';
  amountMinor: number;
  currency: string;
  planCode: string;
}) {
  return paystackRequest<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountMinor),
      currency: input.currency,
      plan: input.planCode,
      callback_url: `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/billing`,
      metadata: {
        learnflowUserId: input.userId,
        billingInterval: input.interval,
        product: 'LEARNFLOW_PRO'
      }
    })
  });
}

export async function disablePaystackSubscription(subscriptionCode: string, emailToken: string) {
  await paystackRequest('/subscription/disable', {
    method: 'POST',
    body: JSON.stringify({ code: subscriptionCode, token: emailToken })
  });
  return { cancelled: true };
}

export function verifyPaystackWebhook(body: unknown, signature?: string) {
  if (!signature || !env.BILLING_API_KEY) return false;
  const expected = crypto.createHmac('sha512', env.BILLING_API_KEY).update(JSON.stringify(body)).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(signature, 'utf8');
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}
