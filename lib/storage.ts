import { STORAGE_KEYS } from './types';

export const storage = {
  async getApiKey(): Promise<string> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return result[STORAGE_KEYS.API_KEY] || '';
  },

  async setApiKey(key: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
  },

  async getResume(): Promise<{ text: string; fileName: string }> {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.RESUME_TEXT,
      STORAGE_KEYS.RESUME_FILE_NAME,
    ]);
    return {
      text: result[STORAGE_KEYS.RESUME_TEXT] || '',
      fileName: result[STORAGE_KEYS.RESUME_FILE_NAME] || '',
    };
  },

  async setResume(text: string, fileName: string): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.RESUME_TEXT]: text,
      [STORAGE_KEYS.RESUME_FILE_NAME]: fileName,
    });
  },

  async clearResume(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.RESUME_TEXT,
      STORAGE_KEYS.RESUME_FILE_NAME,
    ]);
  },

  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key.length > 0;
  },

  async hasResume(): Promise<boolean> {
    const { text } = await this.getResume();
    return text.length > 0;
  },
};
