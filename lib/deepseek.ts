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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
      const errBody = await response.json().catch(() => ({}));
      throw new DeepSeekError(response.status,
        (errBody as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content?.trim();

    if (!raw) throw new DeepSeekError(0, 'Empty response');
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
  // 尝试提取 JSON（可能被 markdown 代码块包裹）
  let jsonStr = raw;
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();

  // 尝试解析 JSON
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const p = JSON.parse(jsonMatch[0]);
      const greeting = String(p.greeting || p.招呼语 || '');
      if (greeting.length >= 10) {
        const rawScore = Number(p.score ?? p.匹配度 ?? NaN);
        return {
          greeting,
          score: Number.isFinite(rawScore) ? Math.round(Math.min(100, Math.max(0, rawScore))) : -1,
          scoreReason: String(p.scoreReason || p.理由 || ''),
        };
      }
    } catch { /* JSON 解析失败，继续降级 */ }
  }

  // 降级：尝试从文本中提取评分
  const sm = raw.match(/评分[：:]\s*(\d+)/) || raw.match(/匹配度[：:]\s*(\d+)/) || raw.match(/"score"\s*:\s*(\d+)/);
  const score = sm ? Math.round(Math.min(100, Math.max(0, Number(sm[1])))) : -1;

  return { greeting: raw, score, scoreReason: '' };
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEEPSEEK_MODEL, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok || response.status === 400;
  } catch { return false; }
}

// 一次调用：提取页面信息 + 生成招呼语
export interface ExtractAndGenerateResult {
  company: string;
  jobTitle: string;
  bossName: string;
  jdText: string;
  greeting: string;
  score: number;
  scoreReason: string;
}

export async function extractAndGenerate(
  apiKey: string,
  resumeText: string,
  pageText: string,
  focus: FocusOption,
): Promise<ExtractAndGenerateResult> {
  const { buildExtractAndGeneratePrompt } = await import('./prompt');
  const { system, user } = buildExtractAndGeneratePrompt(pageText, focus, resumeText);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new DeepSeekError(response.status,
        (errBody as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new DeepSeekError(0, 'Empty response');

    // 解析 JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const p = JSON.parse(jsonMatch[0]);
      return {
        company: String(p.company || ''),
        jobTitle: String(p.jobTitle || ''),
        bossName: String(p.bossName || ''),
        jdText: String(p.jdText || ''),
        greeting: String(p.greeting || ''),
        score: Math.round(Math.min(100, Math.max(0, Number(p.score) || 50))),
        scoreReason: String(p.scoreReason || ''),
      };
    }
    throw new DeepSeekError(0, 'Failed to parse JSON response');
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    if ((err as Error).name === 'AbortError') throw new DeepSeekError(408, '请求超时');
    throw new DeepSeekError(0, `网络错误: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}
