import { useState, useCallback, useRef, useEffect } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse } from '@/lib/types';

const GREETING_CACHE_KEY = 'ga_greeting';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [needsSetup, setNeedsSetup] = useState(true);
  const [debug, setDebug] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((result) => {
      setNeedsSetup(!result.deepseekApiKey);
    });

    // 恢复跨页面缓存
    try {
      const cached = sessionStorage.getItem(GREETING_CACHE_KEY);
      if (cached) {
        setGreeting(cached);
        setStatus('ready');
        // 尝试自动填入
        tryFill(cached);
      }
    } catch {}
  }, []);

  // 持续尝试自动填入（聊天输入框可能在 iframe 里）
  useEffect(() => {
    if (status !== 'ready' || !greeting) return;

    let attempts = 0;
    const interval = setInterval(() => {
      if (attempts++ >= 30) { clearInterval(interval); return; }
      const ok = tryFill(greeting);
      if (ok) clearInterval(interval);
    }, 1000);

    const observer = new MutationObserver(() => tryFill(greeting));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => { clearInterval(interval); observer.disconnect(); };
  }, [status, greeting]);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setDebug('⏳ 提取JD...');
    setStatus('loading');
    setGreeting(null);
    setCopied(false);

    try {
      const { extractJD } = await import('@/lib/jd-extractor');
      const jdText = extractJD();

      if (!jdText) {
        setDebug('❌ 未检测到职位描述');
        setStatus('error');
        return;
      }

      setDebug('⏳ 调用 DeepSeek...');

      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_GREETING', jdText, focus,
      })) as GenerateGreetingResponse;

      if (response.error) {
        setDebug('❌ ' + response.error);
        setStatus('error');
        return;
      }

      const text = response.greeting!;
      setGreeting(text);
      setDebug('');
      setStatus('ready');

      try { sessionStorage.setItem(GREETING_CACHE_KEY, text); } catch {}
      tryFill(text);
    } catch (err) {
      setDebug('❌ ' + (err instanceof Error ? err.message : '未知错误'));
      setStatus('error');
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!greeting) return;
    const ok = await copyText(greeting);
    setCopied(ok);
    showToast(ok ? '✅ 已复制，请粘贴到聊天框 (Ctrl+V)' : '复制失败，请手动选中文字', ok ? 'success' : 'error');
  }, [greeting, showToast]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
      <GreetingButton
        onGenerate={handleGenerate}
        loading={status === 'loading'}
        disabled={needsSetup}
        disabledReason={needsSetup ? '请先设置 API Key' : undefined}
      />
      {debug && (
        <div style={{
          fontSize: 12, marginTop: 4, maxWidth: 280, lineHeight: 1.4,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          color: debug.startsWith('❌') ? '#dc2626' : '#2563eb',
          wordBreak: 'break-all',
        }}>
          {debug}
        </div>
      )}
      {greeting && status === 'ready' && (
        <div style={{
          marginTop: 8, padding: 14, borderRadius: 8, maxWidth: 340,
          background: '#f0fdf4', border: '2px solid #4ade80',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{
            fontSize: 14, lineHeight: 1.7, color: '#1f2937',
            marginBottom: 12, whiteSpace: 'pre-wrap',
          }}>
            {greeting}
          </div>
          <button
            onClick={handleCopy}
            style={{
              width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: copied ? '#16a34a' : '#22c55e', color: '#fff',
            }}
          >
            {copied ? '✅ 已复制 — 请 Ctrl+V 粘贴到聊天框' : '📋 复制招呼语'}
          </button>
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

// ---- 工具 ----

function tryFill(text: string): boolean {
  // 尝试主页面
  let el = findChatInput(document);
  if (el) return doFill(el, text);

  // 尝试 iframe
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        el = findChatInput(doc);
        if (el) return doFill(el, text);
      }
    } catch {}
  }

  return false;
}

function findChatInput(doc: Document): HTMLElement | null {
  // textarea（优先）
  const textareas = doc.querySelectorAll('textarea');
  for (const el of textareas) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 50) return htmlEl;
  }

  // contenteditable
  const editables = doc.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
  for (const el of editables) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20) return htmlEl;
  }

  return null;
}

function doFill(el: HTMLElement, text: string): boolean {
  try {
    el.focus();

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value',
      )?.set;
      if (nativeSetter) nativeSetter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // contenteditable
    el.textContent = '';
    el.focus();
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch { return false; }
}
