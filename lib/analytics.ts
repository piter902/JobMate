// PostHog 追踪（配置写死）

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

export async function track(event: string, props?: Record<string, unknown>): Promise<void> {
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
