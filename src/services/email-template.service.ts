import { env } from '../config/env.js';

export type EmailTone = 'primary' | 'success' | 'warning';

export interface BrandedEmailInput {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting?: string;
  body: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  tone?: EmailTone;
  detailRows?: Array<{ label: string; value: string }>;
  note?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char] ?? char);
}

function accent(tone: EmailTone): string {
  if (tone === 'success') return '#16805c';
  if (tone === 'warning') return '#b65c02';
  return '#0b5bd3';
}

export function brandedEmail(input: BrandedEmailInput): { html: string; text: string } {
  const tone = input.tone ?? 'primary';
  const colour = accent(tone);
  const safeOrigin = env.CLIENT_ORIGIN.replace(/\/$/, '');
  const rows = input.detailRows?.map(row => `
    <tr>
      <td style="padding:9px 0;color:#66758a;font-size:13px;vertical-align:top;width:120px;">${escapeHtml(row.label)}</td>
      <td style="padding:9px 0;color:#172b4d;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(row.value)}</td>
    </tr>`).join('') ?? '';
  const paragraphs = input.body.map(item => `<p style="margin:0 0 14px;color:#44546f;font-size:15px;line-height:1.7;">${escapeHtml(item)}</p>`).join('');
  const cta = input.ctaLabel && input.ctaUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">
      <tr><td style="border-radius:8px;background:${colour};">
        <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">${escapeHtml(input.ctaLabel)}</a>
      </td></tr>
    </table>` : '';
  const details = rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;padding:14px 18px;background:#f7f8fa;border:1px solid #e4e7ec;border-radius:10px;">${rows}</table>` : '';
  const note = input.note ? `<div style="margin-top:20px;padding:12px 14px;border-radius:8px;background:#f7f8fa;color:#66758a;font-size:12px;line-height:1.6;">${escapeHtml(input.note)}</div>` : '';

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(input.title)}</title></head>
  <body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172b4d;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f8;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e1e5eb;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(23,43,77,.08);">
          <tr><td style="padding:22px 28px;background:#10233f;color:#ffffff;">
            <div style="font-size:20px;font-weight:900;letter-spacing:-.3px;">LearnFlow</div>
            <div style="margin-top:3px;font-size:11px;color:#b9c7dc;letter-spacing:.06em;text-transform:uppercase;">Learning accountability workspace</div>
          </td></tr>
          <tr><td style="padding:32px 28px 28px;">
            <div style="font-size:11px;font-weight:800;color:${colour};text-transform:uppercase;letter-spacing:.09em;margin-bottom:9px;">${escapeHtml(input.eyebrow)}</div>
            <h1 style="margin:0 0 18px;color:#172b4d;font-size:26px;line-height:1.25;">${escapeHtml(input.title)}</h1>
            ${input.greeting ? `<p style="margin:0 0 14px;color:#172b4d;font-size:15px;font-weight:700;">Hi ${escapeHtml(input.greeting)},</p>` : ''}
            ${paragraphs}${details}${cta}${note}
          </td></tr>
          <tr><td style="padding:20px 28px;border-top:1px solid #e4e7ec;background:#fafbfc;color:#7a869a;font-size:11px;line-height:1.65;">
            <strong style="color:#44546f;">Please do not reply to this email.</strong> This inbox is not monitored.<br>
            Open LearnFlow directly if you need to update your learning plan, reschedule a lesson, or review your notifications.<br>
            <a href="${safeOrigin}" style="color:#0b5bd3;text-decoration:none;font-weight:700;">Open LearnFlow</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  const text = [
    'LearnFlow', input.title, input.greeting ? `Hi ${input.greeting},` : '', ...input.body,
    ...(input.detailRows?.map(row => `${row.label}: ${row.value}`) ?? []),
    input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : '',
    input.note ?? '',
    'Please do not reply to this email. This inbox is not monitored.',
    `Open LearnFlow: ${safeOrigin}`
  ].filter(Boolean).join('\n\n');

  return { html, text };
}
