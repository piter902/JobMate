import { createRoot } from 'react-dom/client';
import App from '@/components/App';

export default defineContentScript({
  matches: ['*://*.zhipin.com/*'],
  main() {
    // 诊断标记：右下角小圆点，绿色=已加载
    showDiagnostic('🟢 脚本已加载，查找按钮中...');

    waitForChatButton()
      .then((btn) => {
        showDiagnostic('🟢 已找到按钮，注入UI');
        injectUI(btn);
      })
      .catch(() => {
        showDiagnostic('🔴 10秒内未找到"立即沟通"按钮');
      });
  },
});

let diagEl: HTMLElement | null = null;

function showDiagnostic(msg: string) {
  if (!diagEl) {
    diagEl = document.createElement('div');
    diagEl.style.cssText = [
      'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483646',
      'background:rgba(0,0,0,0.85)', 'color:#fff', 'padding:8px 14px',
      'border-radius:8px', 'font-size:13px', 'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'pointer-events:none', 'max-width:300px',
    ].join(';');
    diagEl.id = 'greeting-agent-diag';
    document.body.appendChild(diagEl);
  }
  diagEl.textContent = msg;

  // 10 秒后自动消失
  setTimeout(() => {
    if (diagEl) { diagEl.remove(); diagEl = null; }
  }, 10_000);
}

function waitForChatButton(): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const found = findChatButton();
    if (found) { resolve(found); return; }

    const observer = new MutationObserver(() => {
      const el = findChatButton();
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 10 秒超时
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('timeout'));
    }, 10_000);
  });
}

function findChatButton(): HTMLElement | null {
  // 策略 1: 纯文本匹配（最可靠）
  const allElements = document.querySelectorAll('a, button, span, div');
  for (const el of allElements) {
    const text = (el.textContent || '').trim();
    if (text === '立即沟通' || text === '沟通') {
      const htmlEl = el as HTMLElement;
      if (isVisible(htmlEl)) return htmlEl;
    }
  }

  // 策略 2: 部分文本匹配
  for (const el of allElements) {
    const text = (el.textContent || '').trim();
    if (text.includes('立即沟通')) {
      const htmlEl = el as HTMLElement;
      if (isVisible(htmlEl)) return htmlEl;
    }
  }

  // 策略 3: CSS 选择器匹配
  const cssSelectors = [
    '.btn-chat', '.btn-startchat',
    '[class*="chat-btn"]', '[class*="start-chat"]',
    'a[class*="chat"]', 'button[class*="chat"]',
  ];
  for (const sel of cssSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el && isVisible(el)) return el;
  }

  // 策略 4: job-card 内的最后一个操作元素
  const cards = document.querySelectorAll('[class*="job-card"], [class*="job-item"], [class*="job-list"] li');
  for (const card of cards) {
    const actions = card.querySelectorAll('a, button, span');
    for (const a of actions) {
      const htmlEl = a as HTMLElement;
      const text = htmlEl.textContent?.trim() || '';
      if ((text === '聊' || text.includes('沟通')) && isVisible(htmlEl)) {
        return htmlEl;
      }
    }
  }

  return null;
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
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

  // 成功后移除诊断标记
  if (diagEl) { diagEl.remove(); diagEl = null; }
}
