import { env } from '../config/env.js';

export type AiProvider = 'openai' | 'groq' | 'gemini';

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

export function getAiProviderInfo() {
  const provider = selectedProvider();
  return { provider, model: selectedModel(provider), configured: configured(provider) };
}

export async function generateAiText(prompt: string): Promise<string> {
  const provider = selectedProvider();
  if (!configured(provider)) throw new Error(`AI provider ${provider} is not configured`);

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
    if (!response.ok) throw new Error(`Groq request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  if (provider === 'gemini') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY ?? '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim() ?? '';
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof data.output_text === 'string') return data.output_text.trim();
  for (const item of data.output ?? []) for (const part of item.content ?? []) if (typeof part.text === 'string') return part.text.trim();
  return '';
}
