import { normalizeGreeting } from './greeting-format';

export interface GreetingRecord {
  company: string;
  jobTitle: string;
  bossName: string;
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
    const idx = list.findIndex(r =>
      r.company.trim() === record.company.trim() &&
      r.jobTitle.trim() === record.jobTitle.trim(),
    );
    if (idx >= 0) list.splice(idx, 1);
    list.unshift({ ...record, greeting: normalizeGreeting(record.greeting) });
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  } catch {
    await chrome.storage.local.remove(STORAGE_KEY);
    await chrome.storage.local.set({ [STORAGE_KEY]: [{ ...record, greeting: normalizeGreeting(record.greeting) }] });
  }
}

export async function loadAll(): Promise<GreetingRecord[]> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return ((r[STORAGE_KEY] || []) as GreetingRecord[]).map(record => ({ ...record, greeting: normalizeGreeting(record.greeting) }));
}

/** 匹配：公司全称 + 岗位全称 精确相等 */
export async function findMatch(company: string, jobTitle: string): Promise<GreetingRecord | null> {
  const list = await loadAll();
  return list.find(r =>
    r.company.trim() === company.trim() &&
    r.jobTitle.trim() === jobTitle.trim(),
  ) || null;
}

export async function updateRecord(
  company: string, jobTitle: string,
  updates: Partial<GreetingRecord>,
): Promise<void> {
  const list = await loadAll();
  const idx = list.findIndex(r =>
    r.company.trim() === company.trim() && r.jobTitle.trim() === jobTitle.trim(),
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, greeting: normalizeGreeting(updates.greeting ?? list[idx].greeting), time: Date.now() };
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  }
}
