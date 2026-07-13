import { useState, useCallback, useRef, useEffect } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse } from '@/lib/types';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const { toast, showToast, clearToast } = useToast();
  const greetingRef = useRef<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((result) => {
      setNeedsSetup(!result.deepseekApiKey);
    });
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const inputArea = findChatInput();
      if (inputArea && greetingRef.current) {
        fillInput(inputArea, greetingRef.current);
        navigator.clipboard.writeText(greetingRef.current);
        showToast('✅ 已复制并填入', 'success');
        greetingRef.current = null;
      } else if (inputArea && status === 'loading') {
        showGreetingPendingIndicator(inputArea);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [status, showToast]);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    const { extractJD } = await import('@/lib/jd-extractor');
    const jdText = extractJD();

    if (!jdText) {
      setError('未检测到职位描述');
      setStatus('error');
      showToast('未检测到职位描述，请确认你在职位详情页', 'error');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_GREETING', jdText, focus,
      })) as GenerateGreetingResponse;

      if (response.error) {
        setError(response.error);
        setStatus('error');
        showToast(response.error, 'error');
        return;
      }

      greetingRef.current = response.greeting!;
      setStatus('ready');

      const inputArea = findChatInput();
      if (inputArea && greetingRef.current) {
        fillInput(inputArea, greetingRef.current);
        navigator.clipboard.writeText(greetingRef.current);
        showToast('✅ 已复制并填入', 'success');
        greetingRef.current = null;
      }
    } catch {
      setError('生成失败，请重试');
      setStatus('error');
      showToast('生成失败，请重试', 'error');
    }
  }, [showToast]);

  const disabledReason = needsSetup ? '请先设置 API Key' : undefined;

  return (
    <>
      <GreetingButton
        onGenerate={handleGenerate}
        loading={status === 'loading'}
        disabled={needsSetup}
        disabledReason={disabledReason}
      />
      <Toast toast={toast} onDone={clearToast} />
    </>
  );
}

// ---- 页面 DOM 工具函数 ----

function findChatInput(): HTMLElement | null {
  const selectors = [
    '.chat-input textarea',
    '.chat-input [contenteditable="true"]',
    '.dialog-conversation textarea',
    '[class*="chat"] textarea',
    '[class*="msg"] [contenteditable]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

function fillInput(el: HTMLElement, text: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.getAttribute('contenteditable') === 'true') {
    el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function showGreetingPendingIndicator(inputEl: HTMLElement) {
  const parent = inputEl.parentElement;
  if (!parent) return;
  if (parent.querySelector('.greeting-pending-indicator')) return;

  const indicator = document.createElement('div');
  indicator.className = 'greeting-pending-indicator';
  indicator.textContent = '⏳ 招呼语生成中，稍候...';
  indicator.style.cssText =
    'font-size:12px;color:#9ca3af;padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
  parent.insertBefore(indicator, inputEl);
}
