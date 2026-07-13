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
  const { toast, showToast, clearToast } = useToast();
  const greetingRef = useRef<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((result) => {
      const hasKey = !!result.deepseekApiKey;
      setNeedsSetup(!hasKey);
      if (!hasKey) setDebug('⚠ 未配置 API Key，请点击插件图标设置');
    });

    // 恢复之前缓存的招呼语（跨页面）
    try {
      const cached = sessionStorage.getItem(GREETING_CACHE_KEY);
      if (cached) {
        greetingRef.current = cached;
        setGreeting(cached);
        setStatus('ready');
        setDebug('');
      }
    } catch {}
  }, []);

  // 持续尝试填入聊天输入框
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 30;

    const tryFill = () => {
      if (attempts >= maxAttempts) return;
      const inputArea = findChatInput();
      if (inputArea && greetingRef.current) {
        fillInput(inputArea, greetingRef.current);
        copyToClipboard(greetingRef.current);
        setDebug('✅ 已填入聊天框');
        setCopied(true);

        // 清除缓存
        try { sessionStorage.removeItem(GREETING_CACHE_KEY); } catch {}
        greetingRef.current = null;
        return;
      }
      attempts++;
    };

    tryFill();
    const interval = setInterval(tryFill, 1000);

    const observer = new MutationObserver(tryFill);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setDebug('⏳ 提取JD...');
    setStatus('loading');
    setError(null);
    setGreeting(null);
    setCopied(false);

    try {
      const { extractJD } = await import('@/lib/jd-extractor');
      const jdText = extractJD();

      if (!jdText) {
        setDebug('❌ 未检测到职位描述，请在职位详情页使用');
        setError('未检测到职位描述');
        setStatus('error');
        return;
      }

      setDebug(`⏳ 调用DeepSeek...`);

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

      // 缓存到 sessionStorage（跨页面）
      try { sessionStorage.setItem(GREETING_CACHE_KEY, text); } catch {}

      // 立即尝试填入
      const inputArea = findChatInput();
      if (inputArea) {
        fillInput(inputArea, text);
        copyToClipboard(text);
        setDebug('✅ 已填入并复制');
        setCopied(true);
        try { sessionStorage.removeItem(GREETING_CACHE_KEY); } catch {}
        greetingRef.current = null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setDebug('❌ ' + msg);
      setError(msg);
      setStatus('error');
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!greeting) return;
    const ok = await copyToClipboard(greeting);
    if (ok) {
      setCopied(true);
      showToast('✅ 已复制', 'success');
    } else {
      showToast('复制失败，请手动选中文字复制', 'error');
    }
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
          fontSize: 12, marginTop: 4, maxWidth: 280, lineHeight: 1.5,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          wordBreak: 'break-all',
          color: debug.startsWith('❌') ? '#dc2626' :
            debug.startsWith('✅') ? '#16a34a' :
            debug.startsWith('⏳') ? '#2563eb' : '#374151',
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
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 4,
              border: '1px solid #16a34a', background: copied ? '#16a34a' : '#fff',
              color: copied ? '#fff' : '#16a34a', cursor: 'pointer',
            }}
          >
            {copied ? '✅ 已复制' : '📋 复制'}
          </button>
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

function findChatInput(): HTMLElement | null {
  // 找所有可见的 textarea 和 contenteditable
  const candidates = document.querySelectorAll('textarea, [contenteditable="true"]');
  for (const el of candidates) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 50) {
      const style = window.getComputedStyle(htmlEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        return htmlEl;
      }
    }
  }

  // 带 placeholder 的 textarea（聊天输入框通常有 placeholder）
  const placeholders = document.querySelectorAll('textarea[placeholder*="回复"], textarea[placeholder*="输入"], textarea[placeholder*="消息"], [contenteditable][placeholder*="回复"], [contenteditable][placeholder*="输入"]');
  for (const el of placeholders) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetHeight > 0) return htmlEl;
  }

  return null;
}

function fillInput(el: HTMLElement, text: string) {
  try {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = text;
    } else {
      el.textContent = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {}
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
