import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  provider: 'resend';
  providerMessageId?: string;
  errorMessage?: string;
}

function usesResendTestSender(): boolean {
  return /@resend\.dev\b/i.test(env.EMAIL_FROM);
}

function isResendTestRecipient(email: string): boolean {
  return /@resend\.dev$/i.test(email.trim());
}

export class EmailService {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!env.RESEND_API_KEY) {
      return { status: 'SKIPPED', provider: 'resend', errorMessage: 'RESEND_API_KEY is not configured' };
    }

    if (env.NODE_ENV === 'production' && usesResendTestSender() && !isResendTestRecipient(message.to)) {
      const errorMessage = `Production EMAIL_FROM is still using Resend's test domain (${env.EMAIL_FROM}). Configure EMAIL_FROM with a sender on a verified domain before sending to real users.`;
      console.error('Resend email blocked', errorMessage);
      return { status: 'FAILED', provider: 'resend', errorMessage };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {})
        })
      });

      const body = await response.text();
      if (!response.ok) {
        const errorMessage = `Resend ${response.status}: ${body.slice(0, 600)}`;
        console.error('Resend email failed', errorMessage);
        return { status: 'FAILED', provider: 'resend', errorMessage };
      }

      let providerMessageId: string | undefined;
      try { providerMessageId = (JSON.parse(body) as { id?: string }).id; } catch { /* provider response id is optional */ }
      return { status: 'SENT', provider: 'resend', providerMessageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown email transport error';
      console.error('Resend email failed', errorMessage);
      return { status: 'FAILED', provider: 'resend', errorMessage };
    }
  }
}
export const emailService = new EmailService();
