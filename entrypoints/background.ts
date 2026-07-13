import { generateGreeting, validateApiKey } from '@/lib/deepseek';
import { storage } from '@/lib/storage';
import type { GenerateGreetingRequest, ValidateApiKeyRequest } from '@/lib/types';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
  });
});

async function handleMessage(message: unknown) {
  const msg = message as { type: string };

  switch (msg.type) {
    case 'GENERATE_GREETING': {
      const { jdText, focus } = message as GenerateGreetingRequest;
      try {
        const apiKey = await storage.getApiKey();
        if (!apiKey) {
          return { type: 'GENERATE_GREETING_RESULT', error: '请先设置 API Key' };
        }
        const { text: resumeText } = await storage.getResume();
        const greeting = await generateGreeting({ apiKey, resumeText, jdText, focus });
        return { type: 'GENERATE_GREETING_RESULT', greeting };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '生成失败，请重试';
        return { type: 'GENERATE_GREETING_RESULT', error: errorMessage };
      }
    }

    case 'VALIDATE_API_KEY': {
      const { apiKey } = message as ValidateApiKeyRequest;
      const valid = await validateApiKey(apiKey);
      return { type: 'VALIDATE_API_KEY_RESULT', valid };
    }

    default:
      return { type: 'UNKNOWN' };
  }
}
