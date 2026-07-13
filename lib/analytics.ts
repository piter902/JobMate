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

async function saveLog(entry: Record<string, unknown>) {
  const key = 'ph_recent_events';
  const r = await chrome.storage.local.get(key);
  const events = (r[key] || []).slice(-9);
  events.push(entry);
  await chrome.storage.local.set({ [key]: events });
}

export async function track(event: string, props?: Record<string, unknown>): Promise<void> {
  const entry: Record<string, unknown> = { event, time: new Date().toISOString(), props };

  try {
    const res = await fetch(`${PH_HOST}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY,
        event,
        distinct_id: await getDistinctId(),
        properties: { ...props, $lib: 'greeting-agent' },
      }),
    });
    entry.status = res.status;
    entry.sent = res.ok;
  } catch (err) {
    entry.error = (err as Error).message;
    entry.sent = false;
  }

  await saveLog(entry);
}

export async function getRecentEvents(): Promise<Array<Record<string, unknown>>> {
  const r = await chrome.storage.local.get('ph_recent_events');
  return r['ph_recent_events'] || [];
}
