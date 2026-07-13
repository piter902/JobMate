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
  container.style.cssText = [
    'position:fixed', 'top:12px', 'right:16px',
    'z-index:999999', 'background:#fff', 'padding:12px 16px',
    'border-radius:12px', 'box-shadow:0 2px 20px rgba(0,0,0,0.15)',
    'max-width:340px',
  ].join(';');
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host { all: initial; } * { box-sizing: border-box; }';
  shadow.appendChild(style);
  const root = document.createElement('div');
  shadow.appendChild(root);
  createRoot(root).render(<App />);
}
