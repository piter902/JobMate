import { DEEPSEEK_API_URL, DEEPSEEK_MODEL, GENERATE_TIMEOUT_MS } from './types';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import type { FocusOption, GreetingResult } from './types';

export class DeepSeekError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

export interface GenerateParams {
  apiKey: string;
  resumeText: string;
  jdText: string;
  focus: FocusOption;
}

export async function generateGreeting(params: GenerateParams): Promise<GreetingResult> {
  const { apiKey, resumeText, jdText, focus } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(focus) },
          { role: 'user', content: buildUserPrompt(resumeText, jdText, focus) },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        (errorBody as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`;
      throw new DeepSeekError(response.status, message);
    }

    const data = await response.json();
    const raw = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content?.trim();

    if (!raw) throw new DeepSeekError(0, 'Empty response from DeepSeek');

    return parseResult(raw);
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    if ((err as Error).name === 'AbortError') throw new DeepSeekError(408, '请求超时');
    throw new DeepSeekError(0, `网络错误: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function parseResult(raw: string): GreetingResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        greeting: String(parsed.greeting || ''),
        score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
        scoreReason: String(parsed.scoreReason || ''),
      };
    }
  } catch {}

  const scoreMatch = raw.match(/评分[：:]\s*(\d+)/) || raw.match(/score[：:]\s*(\d+)/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, Number(scoreMatch[1]))) : 50;

  return { greeting: raw, score, scoreReason: '' };
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}
