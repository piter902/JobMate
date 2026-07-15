// 招呼语历史记录 —— 按公司+岗位匹配

export interface GreetingRecord {
  company: string;
  jobTitle: string;
  greeting: string;
  score: number;
  scoreReason: string;
  time: number;
}

const STORAGE_KEY = 'ga_history';

export async function saveGreeting(record: GreetingRecord): Promise<void> {
  try {
    const list = await loadAll();
    list.unshift(record);
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  } catch {
    // 存储满了，清空全部再试
    await chrome.storage.local.remove(STORAGE_KEY);
    await chrome.storage.local.set({ [STORAGE_KEY]: [record] });
  }
}

export async function loadAll(): Promise<GreetingRecord[]> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return (r[STORAGE_KEY] || []) as GreetingRecord[];
}

/** 按公司全称+岗位名称精确匹配 */
export async function findByCompanyAndTitle(
  company: string,
  jobTitle: string,
): Promise<GreetingRecord | null> {
  const list = await loadAll();
  return list.find(
    (r) =>
      r.company.trim() === company.trim() &&
      r.jobTitle.trim() === jobTitle.trim(),
  ) || null;
}

/** 模糊匹配：先精确，不行就只按公司名 */
export async function findMatch(
  company: string,
  jobTitle: string,
): Promise<GreetingRecord | null> {
  const exact = await findByCompanyAndTitle(company, jobTitle);
  if (exact) return exact;

  // 降级：只按公司名找最新的
  const list = await loadAll();
  return list.find((r) => r.company.trim() === company.trim()) || null;
}
