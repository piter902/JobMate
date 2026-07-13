const PH_HOST = 'https://us.i.posthog.com';
const PH_KEY = 'phc_pPLeo5PgFqybDGChr54qCBAsyooEuAv2Y8FGUJZxuqot';

async function getDistinctId(): Promise<string> {
  const idKey = 'ph_distinct_id';
  const r = await chrome.storage.local.get(idKey);
  if (r[idKey]) return r[idKey];
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [idKey]: id });
  return id;
}

/** 保存最近事件到 storage（方便验证） */
async function saveLog(entry: { event: string; time: string; props?: Record<string, unknown> }) {
  const key = 'ph_recent_events';
  const r = await chrome.storage.local.get(key);
  const events = (r[key] || []).slice(-9); // 保留最近10条
  events.push(entry);
  await chrome.storage.local.set({ [key]: events });
}

export async function track(event: string, props?: Record<string, unknown>): Promise<void> {
  const entry = { event, time: new Date().toISOString(), props };
  await saveLog(entry);

  try {
    await fetch(`${PH_HOST}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY,
        event,
        distinct_id: await getDistinctId(),
        properties: { ...props, $lib: 'greeting-agent' },
      }),
    });
  } catch { /* 不影响主流程 */ }
}

/** 读最近事件（popup 调试用） */
export async function getRecentEvents(): Promise<Array<{ event: string; time: string; props?: Record<string, unknown> }>> {
  const r = await chrome.storage.local.get('ph_recent_events');
  return r['ph_recent_events'] || [];
}
