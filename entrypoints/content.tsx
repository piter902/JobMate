import { createRoot } from 'react-dom/client';
import App from '@/components/App';

export default defineContentScript({
  matches: ['*://*.zhipin.com/*'],
  main() {
    waitForChatButton().then((btn) => injectUI(btn));
  },
});

function waitForChatButton(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    // 尝试找到"立即沟通"按钮
    const found = findChatButton();
    if (found) { resolve(found); return; }

    const observer = new MutationObserver(() => {
      const el = findChatButton();
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 10 秒超时
    setTimeout(() => observer.disconnect(), 10_000);
  });
}

function findChatButton(): HTMLElement | null {
  // 策略 1: CSS 选择器匹配常见 class
  const cssSelectors = [
    '.btn-chat',
    '.btn-startchat',
    '[class*="chat-btn"]',
    '[class*="start-chat"]',
    'a[class*="chat"]',
    'button[class*="chat"]',
    '[class*="operate"] [class*="chat"]',
    '.job-card-footer a',
    '.card-footer a',
  ];

  for (const sel of cssSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el && isVisible(el)) return el;
  }

  // 策略 2: 文本匹配 — 找所有包含"沟通"或"聊"的可点击元素
  const candidates = document.querySelectorAll('a, button, span[class*="btn"], div[class*="btn"]');
  for (const el of candidates) {
    const text = el.textContent?.trim() || '';
    if ((text.includes('立即沟通') || text.includes('沟通') || text === '聊')) {
      if (isVisible(el as HTMLElement)) {
        return el as HTMLElement;
      }
    }
  }

  // 策略 3: 找 job-card 内最可能的操作按钮
  const cards = document.querySelectorAll('[class*="job-card"], [class*="job-item"], li[class*="job"]');
  for (const card of cards) {
    const btns = card.querySelectorAll('a, button');
    for (const btn of btns) {
      const btnEl = btn as HTMLElement;
      const text = btnEl.textContent?.trim() || '';
      if (text.length <= 5 && isVisible(btnEl) && btnEl.offsetWidth > 30) {
        return btnEl;
      }
    }
  }

  return null;
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
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
