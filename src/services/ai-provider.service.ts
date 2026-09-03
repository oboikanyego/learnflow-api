import { env } from '../config/env.js';

export type AiProvider = 'openai' | 'groq' | 'gemini';

type ProviderHttpError = Error & { statusCode?: number; exposeMessage?: boolean };

function selectedProvider(): AiProvider {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.GROQ_API_KEY) return 'groq';
  if (env.GEMINI_API_KEY) return 'gemini';
  return 'openai';
}

function configured(provider: AiProvider): boolean {
  if (provider === 'groq') return !!env.GROQ_API_KEY;
  if (provider === 'gemini') return !!env.GEMINI_API_KEY;
  return !!env.OPENAI_API_KEY;
}

function selectedModel(provider: AiProvider): string {
  if (provider === 'groq') return env.GROQ_MODEL;
  if (provider === 'gemini') return env.GEMINI_MODEL;
  return env.OPENAI_MODEL;
}

function providerLabel(provider: AiProvider): string {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'groq') return 'Groq';
  return 'Gemini';
}

function providerKeyName(provider: AiProvider): string {
  if (provider === 'openai') return 'OPENAI_API_KEY';
  if (provider === 'groq') return 'GROQ_API_KEY';
  return 'GEMINI_API_KEY';
}

function extractProviderMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    const message = parsed.error?.message ?? parsed.message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 220);
  } catch {
    // Fall through to a short plain-text provider response.
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function providerRequestError(provider: AiProvider, response: Response): Promise<ProviderHttpError> {
  const label = providerLabel(provider);
  const detail = extractProviderMessage(await response.text());
  let message: string;
  let statusCode = 502;

  if (response.status === 401 || response.status === 403) {
    statusCode = 503;
    message = `${label} authentication failed. Check ${providerKeyName(provider)} on Render.`;
  } else if (response.status === 429) {
    statusCode = 503;
    message = `${label} rate limit or account quota was reached. Check the provider quota/billing for the configured API key.`;
  } else if (response.status === 400 || response.status === 404) {
    message = `${label} rejected the configured AI request (${response.status})${detail ? `: ${detail}` : '.'}`;
  } else {
    message = `${label} is temporarily unavailable (${response.status})${detail ? `: ${detail}` : '.'}`;
  }

  const error = new Error(message) as ProviderHttpError;
  error.statusCode = statusCode;
  error.exposeMessage = true;
  return error;
}

function emptyProviderResponseError(provider: AiProvider): ProviderHttpError {
  const error = new Error(`${providerLabel(provider)} returned an empty response. Try again or verify the configured model.`) as ProviderHttpError;
  error.statusCode = 502;
  error.exposeMessage = true;
  return error;
}

export function getAiProviderInfo() {
  const provider = selectedProvider();
  return { provider, model: selectedModel(provider), configured: configured(provider) };
}

export async function generateAiText(prompt: string): Promise<string> {
  const provider = selectedProvider();
  if (!configured(provider)) {
    const error = new Error(`AI provider ${provider} is not configured. Configure ${providerKeyName(provider)} on Render.`) as ProviderHttpError;
    error.statusCode = 503;
    error.exposeMessage = true;
    throw error;
  }

  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.35,
        messages: [
          { role: 'system', content: 'You are LearnFlow, a practical learning coach. Be concise, structured and action-oriented.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!response.ok) throw await providerRequestError(provider, response);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw emptyProviderResponseError(provider);
    return text;
  }

  if (provider === 'gemini') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY ?? '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw await providerRequestError(provider, response);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim() ?? '';
    if (!text) throw emptyProviderResponseError(provider);
    return text;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) throw await providerRequestError(provider, response);
  const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === 'string' && part.text.trim()) return part.text.trim();
    }
  }
  throw emptyProviderResponseError(provider);
}
