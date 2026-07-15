export interface GreetingRecord {
  company: string;
  jobTitle: string;
  jdText: string;
  greeting: string;
  score: number;
  scoreReason: string;
  time: number;
}

const STORAGE_KEY = 'ga_history';

export async function saveGreeting(record: GreetingRecord): Promise<void> {
  try {
    const list = await loadAll();
    // 去重：同公司+同岗位的旧记录替换
    const idx = list.findIndex(
      r => r.company === record.company && r.jobTitle === record.jobTitle,
    );
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(record);
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  } catch {
    await chrome.storage.local.remove(STORAGE_KEY);
    await chrome.storage.local.set({ [STORAGE_KEY]: [record] });
  }
}

export async function loadAll(): Promise<GreetingRecord[]> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return (r[STORAGE_KEY] || []) as GreetingRecord[];
}

export async function findMatch(company: string, jobTitle: string): Promise<GreetingRecord | null> {
  const list = await loadAll();
  // 精确匹配
  const exact = list.find(r => r.company.trim() === company.trim() && r.jobTitle.trim() === jobTitle.trim());
  if (exact) return exact;
  // 降级：只按公司名
  return list.find(r => r.company.trim() === company.trim()) || null;
}

/** 更新已有记录（用于重新生成后覆盖） */
export async function updateRecord(company: string, jobTitle: string, updates: Partial<GreetingRecord>): Promise<void> {
  const list = await loadAll();
  const idx = list.findIndex(r => r.company === company && r.jobTitle === jobTitle);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, time: Date.now() };
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  }
}
