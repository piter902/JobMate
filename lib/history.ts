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
      r.company === record.company &&
      r.jobTitle === record.jobTitle &&
      r.bossName === record.bossName,
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

/** 多维匹配：公司+岗位+发布人 */
export async function findMatch(
  company: string,
  jobTitle: string,
  bossName: string,
): Promise<GreetingRecord | null> {
  const list = await loadAll();

  // 1. 精确：公司 + 岗位 + 发布人
  let m = list.find(r =>
    r.company.trim() === company.trim() &&
    r.jobTitle.trim() === jobTitle.trim() &&
    r.bossName.trim() === bossName.trim(),
  );
  if (m) return m;

  // 2. 岗位 + 发布人（无视公司，聊天页没公司）
  m = list.find(r =>
    r.jobTitle.trim() === jobTitle.trim() &&
    r.bossName.trim() === bossName.trim(),
  );
  if (m) return m;

  // 3. 公司 + 岗位
  if (company) {
    m = list.find(r =>
      r.company.trim() === company.trim() &&
      r.jobTitle.trim() === jobTitle.trim(),
    );
    if (m) return m;
  }

  // 4. 仅岗位名降级
  return list.find(r => r.jobTitle.trim() === jobTitle.trim()) || null;
}

export async function updateRecord(
  company: string, jobTitle: string, bossName: string,
  updates: Partial<GreetingRecord>,
): Promise<void> {
  const list = await loadAll();
  const idx = list.findIndex(r =>
    r.company === company && r.jobTitle === jobTitle && r.bossName === bossName,
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, time: Date.now() };
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  }
}
