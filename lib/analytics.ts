// 极简 PostHog 追踪（直接调 /capture API，零依赖）

const STORAGE_KEY = 'ph_config';

interface PhConfig { host: string; key: string }

async function getConfig(): Promise<PhConfig | null> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || null;
}

async function getDistinctId(): Promise<string> {
  const idKey = 'ph_distinct_id';
  const r = await chrome.storage.local.get(idKey);
  if (r[idKey]) return r[idKey];
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [idKey]: id });
  return id;
}

/** 发送事件 */
export async function track(event: string, props?: Record<string, unknown>): Promise<void> {
  const cfg = await getConfig();
  if (!cfg) return;
  try {
    await fetch(`${cfg.host}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: cfg.key,
        event,
        distinct_id: await getDistinctId(),
        properties: { ...props, $lib: 'greeting-agent' },
      }),
    });
  } catch { /* 不影响主流程 */ }
}

/** 保存配置 */
export async function saveConfig(host: string, key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: { host: host.replace(/\/+$/, ''), key } });
}

/** 读取配置 */
export async function loadConfig(): Promise<PhConfig> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || { host: '', key: '' };
}
