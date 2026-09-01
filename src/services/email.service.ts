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

export class EmailService {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!env.RESEND_API_KEY) {
      return { status: 'SKIPPED', provider: 'resend', errorMessage: 'RESEND_API_KEY is not configured' };
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
