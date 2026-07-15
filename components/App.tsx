import { useState, useCallback, useEffect, useRef } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse, GreetingResult } from '@/lib/types';
import { track } from '@/lib/analytics';

const CACHE_KEY = 'ga_result';

type Status = 'idle' | 'loading' | 'ready' | 'error';

function scoreColor(s: number): string {
  if (s < 0) return '#9ca3af';
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#f59e0b';
  return '#dc2626';
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [needsSetup, setNeedsSetup] = useState(true);
  const [debug, setDebug] = useState('');
  const [result, setResult] = useState<GreetingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const { toast, showToast, clearToast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((r) => setNeedsSetup(!r.deepseekApiKey));
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const r = JSON.parse(cached) as GreetingResult;
        setResult(r); setStatus('ready'); setCollapsed(false);
        // 恢复后也尝试自动填入
        scheduleAutoFill(r.greeting);
      }
    } catch {}
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const scheduleAutoFill = useCallback((text: string) => {
    // 等 3 秒让聊天 iframe 完全加载，然后尝试填入
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const ok = tryAutoFill(text);
      if (ok) {
        setAutoFilled(true);
        setDebug('✅ 已自动填入');
        showToast('✅ 已自动填入聊天框', 'success');
        try { sessionStorage.removeItem(CACHE_KEY); } catch {}
      }
    }, 3000);
  }, [showToast]);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setCollapsed(false);
    setDebug('⏳ 分析中...');
    setStatus('loading');
    setResult(null);
    setCopied(false);
    setAutoFilled(false);

    try {
      const { extractJD } = await import('@/lib/jd-extractor');
      const jdText = extractJD();
      if (!jdText) { setDebug('❌ 未检测到职位描述'); setStatus('error'); return; }

      setDebug('⏳ 分析匹配度...');
      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_GREETING', jdText, focus,
      })) as GenerateGreetingResponse;

      if (response.error) { setDebug('❌ ' + response.error); setStatus('error'); return; }

      const r = response.result!;
      setResult(r);
      setDebug('');
      setStatus('ready');
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(r)); } catch {}

      // 复制 + 尝试自动填入
      track('greeting_button_clicked', { focus });
      await copyText(r.greeting);
      setCopied(true);

      scheduleAutoFill(r.greeting);
    } catch (err) {
      setDebug('❌ ' + (err instanceof Error ? err.message : '网络错误'));
      setStatus('error');
    }
  }, [scheduleAutoFill]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyText(result.greeting);
    setCopied(ok);
    showToast(ok ? '✅ 已复制' : '复制失败', ok ? 'success' : 'error');
  }, [result, showToast]);

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} style={{
        width: 40, height: 40, borderRadius: '50%', background: '#5ebb8a',
        color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>🤖</button>
    );
  }

  const s = result?.score ?? -1;
  const valid = s >= 0;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>招呼语助手</span>
        <button onClick={() => setCollapsed(true)} style={{
          background: 'none', border: '1px solid #e5e7eb', borderRadius: 4,
          color: '#9ca3af', fontSize: 11, cursor: 'pointer', padding: '1px 8px',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>收起</button>
      </div>
      <GreetingButton
        onGenerate={handleGenerate} loading={status === 'loading'}
        disabled={needsSetup} disabledReason={needsSetup ? '请先设置 API Key' : undefined}
      />
      {debug && (
        <div style={{ fontSize: 12, marginTop: 4, maxWidth: 300, lineHeight: 1.4,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          color: debug.startsWith('❌') ? '#dc2626' : '#2563eb' }}>{debug}</div>
      )}
      {result && status === 'ready' && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 8, maxWidth: 340,
          background: '#fff', border: '1px solid #e5e7eb',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            padding: '8px 12px', borderRadius: 6,
            background: valid ? (s >= 80 ? '#f0fdf4' : s >= 60 ? '#fffbeb' : '#fef2f2') : '#f9fafb' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>匹配度</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: scoreColor(s), lineHeight: 1 }}>
              {valid ? s : '—'}
            </span>
            {valid && <span style={{ fontSize: 12, color: '#9ca3af' }}>/100</span>}
            {valid && (
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{ width: `${s}%`, height: '100%', borderRadius: 3,
                  background: scoreColor(s), transition: 'width 0.5s' }} />
              </div>
            )}
          </div>
          {result.scoreReason && (
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.5,
              padding: '6px 8px', borderRadius: 4, background: '#f9fafb' }}>
              💡 {result.scoreReason}
            </div>
          )}
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f2937', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
            {result.greeting}
          </div>
          {autoFilled ? (
            <div style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600,
              borderRadius: 6, border: 'none', textAlign: 'center',
              background: '#f0fdf4', color: '#16a34a' }}>
              ✅ 已自动填入聊天框
            </div>
          ) : (
            <button onClick={handleCopy} style={{
              width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: copied ? '#16a34a' : '#22c55e', color: '#fff',
            }}>{copied ? '✅ 已复制 — Ctrl+V 粘贴' : '📋 复制招呼语'}</button>
          )}
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

// ---- 自动填入 ----

function tryAutoFill(text: string): boolean {
  // 1. 主文档
  let el = findInput(document);
  if (el) return doFill(el, text);

  // 2. 同源 iframe（静默跳过跨域的）
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) continue;
      el = findInput(doc);
      if (el) return doFill(el, text);
    } catch { /* 跨域 iframe，跳过 */ }
  }

  return false;
}

function findInput(doc: Document): HTMLElement | null {
  for (const el of doc.querySelectorAll('textarea, [contenteditable="true"]')) {
    const he = el as HTMLElement;
    if (he.offsetHeight > 20 && he.offsetWidth > 50) return he;
  }
  return null;
}

function doFill(el: HTMLElement, text: string): boolean {
  try {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const ns = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (ns) ns.call(el, text); else el.value = text;
    } else {
      el.textContent = '';
      document.execCommand('insertText', false, text);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch { return false; }
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch { return false; }
}
