import { createRoot } from 'react-dom/client';
import App from '@/components/App';

export default defineContentScript({
  matches: ['*://*.zhipin.com/*'],
  main() {
    waitForButton().then((btn) => injectUI(btn as HTMLElement));
  },
});

function waitForButton(): Promise<Element> {
  const selector = '.btn-chat, .btn-startchat, [class*="chat"] button, [class*="start-chat"]';
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing); return; }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
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
  style.textContent = ':host { all: initial; } * { box-sizing: border-box; }';
  shadow.appendChild(style);

  const root = document.createElement('div');
  shadow.appendChild(root);

  createRoot(root).render(<App />);
}
