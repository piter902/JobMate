import { useState, useCallback, useEffect } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse } from '@/lib/types';

const CACHE_KEY = 'ga_greeting';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [needsSetup, setNeedsSetup] = useState(true);
  const [debug, setDebug] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  useEffect(() => {
    chrome.storage.local.get('deepseekApiKey').then((r) => {
      setNeedsSetup(!r.deepseekApiKey);
    });
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) { setGreeting(cached); setStatus('ready'); setCollapsed(false); }
    } catch {}
  }, []);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setCollapsed(false);
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
      try { sessionStorage.setItem(CACHE_KEY, text); } catch {}

      const ok = await copyText(text);
      if (ok) {
        setCopied(true);
        showToast('✅ 已复制，Ctrl+V 粘贴', 'success');
      }
    } catch (err) {
      setDebug('❌ ' + (err instanceof Error ? err.message : '网络错误'));
      setStatus('error');
    }
  }, [showToast]);

  const handleCopy = useCallback(async () => {
    if (!greeting) return;
    const ok = await copyText(greeting);
    setCopied(ok);
    showToast(ok ? '✅ 已复制' : '复制失败', ok ? 'success' : 'error');
  }, [greeting, showToast]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#5ebb8a', color: '#fff', border: 'none',
          fontSize: 18, cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="展开招呼语助手"
      >
        🤖
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
      {/* 标题栏 + 收起按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>招呼语助手</span>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none', color: '#9ca3af',
            fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1,
          }}
          title="收起"
        >
          −
        </button>
      </div>
      <GreetingButton
        onGenerate={handleGenerate}
        loading={status === 'loading'}
        disabled={needsSetup}
        disabledReason={needsSetup ? '请先设置 API Key' : undefined}
      />
      {debug && (
        <div style={{
          fontSize: 12, marginTop: 4, maxWidth: 300, lineHeight: 1.4,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          color: debug.startsWith('❌') ? '#dc2626' :
            debug.startsWith('✅') ? '#16a34a' : '#2563eb',
          wordBreak: 'break-all',
        }}>
          {debug}
        </div>
      )}
      {greeting && status === 'ready' && (
        <div style={{
          marginTop: 8, padding: 12, borderRadius: 8, maxWidth: 340,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f2937', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
            {greeting}
          </div>
          <button onClick={handleCopy} style={{
            width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            background: copied ? '#16a34a' : '#22c55e', color: '#fff',
          }}>
            {copied ? '✅ 已复制 — Ctrl+V 粘贴' : '📋 复制招呼语'}
          </button>
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
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
