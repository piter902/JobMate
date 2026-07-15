import { STORAGE_KEYS } from './types';

export interface ResumeItem {
  id: string;
  text: string;
  fileName: string;
  time: number;
}

export const storage = {
  async getApiKey(): Promise<string> {
    const r = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return r[STORAGE_KEYS.API_KEY] || '';
  },

  async setApiKey(key: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
  },

  // ---- 多简历管理 ----

  async getResumes(): Promise<ResumeItem[]> {
    const r = await chrome.storage.local.get('resumes');
    return (r['resumes'] || []) as ResumeItem[];
  },

  async saveResumes(list: ResumeItem[]): Promise<void> {
    await chrome.storage.local.set({ resumes: list });
  },

  async addResume(text: string, fileName: string): Promise<ResumeItem> {
    const list = await this.getResumes();
    const item: ResumeItem = { id: crypto.randomUUID(), text, fileName, time: Date.now() };
    list.unshift(item);
    await this.saveResumes(list);
    // 自动选中新上传的
    await this.selectResume(item.id);
    return item;
  },

  async removeResume(id: string): Promise<void> {
    const list = (await this.getResumes()).filter(r => r.id !== id);
    await this.saveResumes(list);
    const sel = await this.getSelectedResumeId();
    if (sel === id) await this.selectResume(list[0]?.id || '');
  },

  async getSelectedResumeId(): Promise<string> {
    const r = await chrome.storage.local.get('selectedResumeId');
    return r['selectedResumeId'] || '';
  },

  async selectResume(id: string): Promise<void> {
    await chrome.storage.local.set({ selectedResumeId: id });
  },

  async getActiveResume(): Promise<{ text: string; fileName: string }> {
    const list = await this.getResumes();
    const selId = await this.getSelectedResumeId();
    const active = list.find(r => r.id === selId) || list[0];
    return active ? { text: active.text, fileName: active.fileName } : { text: '', fileName: '' };
  },

  async hasApiKey(): Promise<boolean> {
    return (await this.getApiKey()).length > 0;
  },

  async hasResume(): Promise<boolean> {
    const { text } = await this.getActiveResume();
    return text.length > 0;
  },
};
