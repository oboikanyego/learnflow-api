import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!env.RESEND_API_KEY) return;
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
    if (!response.ok) console.error('Resend email failed', response.status, (await response.text()).slice(0, 300));
  }
}
export const emailService = new EmailService();
