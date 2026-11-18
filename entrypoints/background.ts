import { generateResumeGreeting } from '@/lib/resume-greeting';
import { generateGreeting, extractAndGenerate, validateApiKey } from '@/lib/deepseek';
import { storage } from '@/lib/storage';
import { track } from '@/lib/analytics';
import type { FocusOption } from '@/lib/types';

interface ExtReq { type: 'EXTRACT_AND_GENERATE'; pageText: string; focus: FocusOption }
interface GenReq { type: 'GENERATE_GREETING'; jdText: string; focus: FocusOption }
interface ValReq { type: 'VALIDATE_API_KEY'; apiKey: string }

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
  });
});

async function handleMessage(message: unknown) {
  const msg = message as { type: string };

  switch (msg.type) {
    case 'GENERATE_RESUME_GREETING': {
      try {
        const { text } = await storage.getActiveResume();
        return { type: 'GENERATE_RESUME_GREETING_RESULT', result: generateResumeGreeting(text) };
      } catch (err) {
        return { type: 'GENERATE_RESUME_GREETING_RESULT', error: (err as Error).message };
      }
    }
    case 'EXTRACT_AND_GENERATE': {
      const { pageText, focus } = message as ExtReq;
      try {
        const apiKey = await storage.getApiKey();
        if (!apiKey) return { type: 'EXTRACT_AND_GENERATE_RESULT', error: '请先设置 API Key' };
        const { text: resumeText } = await storage.getActiveResume();
        const result = await extractAndGenerate(apiKey, resumeText, pageText, focus);
        track('greeting_generated', { focus, score: result.score, via: 'llm_extract' });
        return { type: 'EXTRACT_AND_GENERATE_RESULT', result };
      } catch (err) {
        track('greeting_error', { error: (err as Error).message });
        return { type: 'EXTRACT_AND_GENERATE_RESULT', error: (err as Error).message || '生成失败' };
      }
    }

    case 'GENERATE_GREETING': {
      const { jdText, focus } = message as GenReq;
      try {
        const apiKey = await storage.getApiKey();
        if (!apiKey) return { type: 'GENERATE_GREETING_RESULT', error: '请先设置 API Key' };
        const { text: resumeText } = await storage.getActiveResume();
        const result = jdText.trim() ? await generateGreeting({ apiKey, resumeText, jdText, focus }) : generateResumeGreeting(resumeText);
        track('greeting_generated', { focus, score: result.score });
        return { type: 'GENERATE_GREETING_RESULT', result };
      } catch (err) {
        track('greeting_error', { error: (err as Error).message });
        return { type: 'GENERATE_GREETING_RESULT', error: (err as Error).message || '生成失败' };
      }
    }

    case 'VALIDATE_API_KEY': {
      const { apiKey } = message as ValReq;
      const valid = await validateApiKey(apiKey);
      return { type: 'VALIDATE_API_KEY_RESULT', valid };
    }

    default:
      return { type: 'UNKNOWN' };
  }
}
