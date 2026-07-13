import { createRoot } from 'react-dom/client';
import App from '@/components/App';

export default defineContentScript({
  matches: ['*://*.zhipin.com/*'],
  async main() {
    try {
      await ensureBody();
      const banner = showBanner('✅ 插件已加载，查找"立即沟通"按钮...', 'blue');

      const btn = await waitForChatButton();
      banner.textContent = '✅ 已找到按钮，注入UI';
      banner.style.background = 'green';

      injectUI(btn);

      setTimeout(() => banner.remove(), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showBanner('❌ ' + msg, 'red');
    }
  },
});

function ensureBody(): Promise<void> {
  return new Promise((resolve) => {
    if (document.body) { resolve(); return; }
    const check = () => {
      if (document.body) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

function showBanner(msg: string, color: string): HTMLElement {
  // 移除旧 banner
  document.getElementById('ga-banner')?.remove();

  const el = document.createElement('div');
  el.id = 'ga-banner';
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:99999999', 'padding:12px 24px', 'border-radius:8px',
    'color:#fff', 'font-size:14px', 'font-weight:600',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3)', 'pointer-events:none',
    `background:${color}`,
  ].join(';');
  document.body.appendChild(el);
  return el;
}

function waitForChatButton(): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const found = findChatButton();
    if (found) { resolve(found); return; }

    const observer = new MutationObserver(() => {
      const el = findChatButton();
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error('未找到"立即沟通"按钮，请在职位详情页使用'));
    }, 15_000);
  });
}

function findChatButton(): HTMLElement | null {
  const all = document.querySelectorAll('a, button, span, div');
  for (const el of all) {
    const text = (el.textContent || '').trim();
    if (text === '立即沟通') {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        return htmlEl;
      }
    }
  }
  return null;
}

function injectUI(targetBtn: HTMLElement) {
  if (document.getElementById('greeting-agent-root')) return;

  const container = document.createElement('span');
  container.id = 'greeting-agent-root';
  container.style.cssText =
    'display:inline-flex;position:relative;margin-left:8px;vertical-align:middle;';
  targetBtn.parentElement?.insertBefore(container, targetBtn.nextSibling);

  const shadow = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host { all: initial; display: inline-flex; } * { box-sizing: border-box; }';
  shadow.appendChild(style);
  const root = document.createElement('div');
  shadow.appendChild(root);
  createRoot(root).render(<App />);
}
