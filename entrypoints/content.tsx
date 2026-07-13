import { createRoot } from 'react-dom/client';
import App from '@/components/App';

export default defineContentScript({
  matches: ['*://*.zhipin.com/*'],
  async main() {
    await ensureBody();
    injectUI();
  },
});

function ensureBody(): Promise<void> {
  return new Promise((resolve) => {
    if (document.body) { resolve(); return; }
    const check = () => { if (document.body) resolve(); else setTimeout(check, 50); };
    check();
  });
}

function injectUI() {
  if (document.getElementById('greeting-agent-root')) return;

  const container = document.createElement('div');
  container.id = 'greeting-agent-root';

  const chatBtn = findElement('立即沟通');
  const chatInput = findChatInput();

  if (chatInput) {
    container.style.cssText = 'position:relative;margin-bottom:8px;z-index:999999;';
    chatInput.parentElement?.insertBefore(container, chatInput);
  } else if (chatBtn) {
    container.style.cssText = 'display:inline-flex;position:relative;margin-left:8px;vertical-align:middle;z-index:999999;';
    chatBtn.parentElement?.insertBefore(container, chatBtn.nextSibling);
  } else {
    container.style.cssText = 'position:fixed;bottom:100px;right:20px;z-index:999999;';
    document.body.appendChild(container);
  }

  const shadow = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host { all: initial; } * { box-sizing: border-box; }';
  shadow.appendChild(style);
  const root = document.createElement('div');
  shadow.appendChild(root);
  createRoot(root).render(<App />);
}

function findElement(text: string): HTMLElement | null {
  const all = document.querySelectorAll('a, button, span, div');
  for (const el of all) {
    if ((el.textContent || '').trim() === text) {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') return htmlEl;
    }
  }
  return null;
}

function findChatInput(): HTMLElement | null {
  const textareas = document.querySelectorAll('textarea');
  for (const el of textareas) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 50) return htmlEl;
  }
  const editables = document.querySelectorAll('[contenteditable="true"]');
  for (const el of editables) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20) return htmlEl;
  }
  return null;
}
