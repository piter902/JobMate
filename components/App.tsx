import { useState, useCallback, useRef, useEffect } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse } from '@/lib/types';

const GREETING_CACHE_KEY = 'greeting_agent_last_greeting';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [debug, setDebug] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filled, setFilled] = useState(false);
  const { toast, showToast, clearToast } = useToast();
  const greetingRef = useRef<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((result) => {
      const hasKey = !!result.deepseekApiKey;
      setNeedsSetup(!hasKey);
      if (!hasKey) setDebug('⚠ 未配置 API Key');
    });

    // 恢复缓存
    try {
      const cached = sessionStorage.getItem(GREETING_CACHE_KEY);
      if (cached) {
        greetingRef.current = cached;
        setGreeting(cached);
        setStatus('ready');
        tryAutoFill();
      }
    } catch {}
  }, []);

  const tryAutoFill = useCallback(() => {
    if (!greetingRef.current) return;
    const inputArea = findChatInput();
    if (inputArea) {
      const ok = fillInput(inputArea, greetingRef.current);
      if (ok) {
        copyToClipboard(greetingRef.current);
        setFilled(true);
        setDebug('✅ 已填入');
        try { sessionStorage.removeItem(GREETING_CACHE_KEY); } catch {}
        greetingRef.current = null;
      }
    }
  }, []);

  // 持续尝试填入
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      if (attempts >= 60) { clearInterval(interval); return; }
      attempts++;
      tryAutoFill();
    }, 1000);

    const observer = new MutationObserver(() => tryAutoFill());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => { clearInterval(interval); observer.disconnect(); };
  }, [tryAutoFill]);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setDebug('⏳ 提取JD...');
    setStatus('loading');
    setError(null);
    setGreeting(null);
    setCopied(false);
    setFilled(false);

    try {
      const { extractJD } = await import('@/lib/jd-extractor');
      const jdText = extractJD();

      if (!jdText) {
        setDebug('❌ 未检测到职位描述');
        setError('未检测到职位描述');
        setStatus('error');
        return;
      }

      setDebug('⏳ 调用DeepSeek...');

      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_GREETING', jdText, focus,
      })) as GenerateGreetingResponse;

      if (response.error) {
        setDebug('❌ ' + response.error);
        setError(response.error);
        setStatus('error');
        return;
      }

      const text = response.greeting!;
      greetingRef.current = text;
      setGreeting(text);
      setDebug('');
      setStatus('ready');

      try { sessionStorage.setItem(GREETING_CACHE_KEY, text); } catch {}
      tryAutoFill();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setDebug('❌ ' + msg);
      setError(msg);
      setStatus('error');
    }
  }, [tryAutoFill]);

  const handleCopy = useCallback(async () => {
    if (!greeting) return;
    const ok = await copyToClipboard(greeting);
    if (ok) setCopied(true);
    showToast(ok ? '✅ 已复制' : '复制失败，请手动选中', ok ? 'success' : 'error');
  }, [greeting, showToast]);

  const handleRetryFill = useCallback(() => {
    if (!greeting) return;
    greetingRef.current = greeting;
    setFilled(false);
    tryAutoFill();
  }, [greeting, tryAutoFill]);

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
          fontSize: 12, marginTop: 4, maxWidth: 280, lineHeight: 1.5,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          wordBreak: 'break-all',
          color: debug.startsWith('❌') ? '#dc2626' :
            debug.startsWith('✅') ? '#16a34a' : '#2563eb',
        }}>
          {debug}
        </div>
      )}
      {greeting && status === 'ready' && (
        <div style={{
          marginTop: 8, padding: 12, borderRadius: 8,
          background: '#f0faf5', border: '1px solid #bbf7d0',
          maxWidth: 320, fontSize: 14, lineHeight: 1.6,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          color: '#374151',
        }}>
          <div style={{ marginBottom: 8 }}>{greeting}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopy} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 4,
              border: '1px solid #16a34a', background: copied ? '#16a34a' : '#fff',
              color: copied ? '#fff' : '#16a34a', cursor: 'pointer',
            }}>
              {copied ? '✅ 已复制' : '📋 复制'}
            </button>
            {!filled && (
              <button onClick={handleRetryFill} style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 4,
                border: '1px solid #2563eb', background: '#fff',
                color: '#2563eb', cursor: 'pointer',
              }}>
                📝 填入输入框
              </button>
            )}
          </div>
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

// ---- 工具函数 ----

function findChatInput(): HTMLElement | null {
  // 先找 textarea
  const textareas = document.querySelectorAll('textarea');
  for (const el of textareas) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 50) {
      const style = window.getComputedStyle(htmlEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        return htmlEl;
      }
    }
  }

  // 再找 contenteditable
  const editables = document.querySelectorAll('[contenteditable="true"]');
  for (const el of editables) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 50) {
      return htmlEl;
    }
  }

  return null;
}

function fillInput(el: HTMLElement, text: string): boolean {
  try {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      // 使用原生 setter 绕过 React 受控组件
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value',
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      return true;
    }

    if (el.getAttribute('contenteditable') === 'true' || (el as HTMLElement & { isContentEditable: boolean }).isContentEditable) {
      el.focus();
      // 清空并用 execCommand 插入
      el.textContent = '';
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch (e) {
    console.error('fillInput failed:', e);
  }
  return false;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
