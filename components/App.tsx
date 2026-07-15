import { useState, useCallback, useEffect, useRef } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GenerateGreetingResponse, GreetingResult } from '@/lib/types';
import { track } from '@/lib/analytics';
import { saveGreeting, findMatch, updateRecord } from '@/lib/history';

const CACHE_KEY = 'ga_result';
const POLL_INTERVAL = 100;
const POLL_TIMEOUT = 5000;

type Status = 'idle' | 'loading' | 'ready' | 'error';
type PageMode = 'generate' | 'history';

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
  const [pageMode, setPageMode] = useState<PageMode>('generate');
  const [regenerating, setRegenerating] = useState(false);
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentBoss, setCurrentBoss] = useState('');
  const { toast, showToast, clearToast } = useToast();

  const autoFilledRef = useRef(false);
  const greetingRef = useRef('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const beginPoll = useCallback((text: string) => {
    stopPoll(); autoFilledRef.current = false; greetingRef.current = text; pollStartRef.current = Date.now();
    const tick = () => {
      if (autoFilledRef.current) { stopPoll(); return; }
      if (Date.now() - pollStartRef.current >= POLL_TIMEOUT) { stopPoll(); return; }
      const input = findInputAnywhere(); if (!input) return;
      if (getInputValue(input).trim().length > 0) { stopPoll(); return; }
      if (doFill(input, greetingRef.current)) {
        autoFilledRef.current = true; setAutoFilled(true); setDebug(''); stopPoll();
        showToast('✅ 已自动填入聊天框', 'success');
      }
    };
    tick(); pollTimerRef.current = setInterval(tick, POLL_INTERVAL);
  }, [stopPoll, showToast]);

  const doGenerate = useCallback(async (
    jdText: string, focus: FocusOption, company: string, title: string, boss: string,
  ): Promise<GreetingResult | null> => {
    const response = (await chrome.runtime.sendMessage({
      type: 'GENERATE_GREETING', jdText, focus,
    })) as GenerateGreetingResponse;
    if (response.error) { setDebug('❌ ' + response.error); setStatus('error'); return null; }
    const r = response.result!;
    setResult(r); setStatus('ready');
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(r)); } catch {}
    try {
      if (company || title) {
        await saveGreeting({
          company: company || title, jobTitle: title || '', bossName: boss || '',
          jdText, greeting: r.greeting, score: r.score,
          scoreReason: r.scoreReason, time: Date.now(),
        });
      }
    } catch {}
    await copyText(r.greeting); setCopied(true);
    beginPoll(r.greeting);
    return r;
  }, [beginPoll]);

  useEffect(() => {
    (async () => {
      try {
        const r = await chrome.storage.local.get('deepseekApiKey');
        setNeedsSetup(!r.deepseekApiKey);

        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          setResult(JSON.parse(cached)); setStatus('ready'); setCollapsed(false);
          setPageMode('generate'); beginPoll(JSON.parse(cached).greeting);
          return;
        }

        const { extractCompany, extractJobTitle, extractBossName } = await import('@/lib/jd-extractor');
        const company = extractCompany();
        const title = extractJobTitle();
        const boss = extractBossName();
        setCurrentCompany(company); setCurrentTitle(title); setCurrentBoss(boss);

        if (!company && !title && !boss) return;

        const { extractJD } = await import('@/lib/jd-extractor');
        const jdText = extractJD();

        if (jdText) { setPageMode('generate'); return; }

        const record = await findMatch(company, title, boss);
        if (record) {
          setResult({ greeting: record.greeting, score: record.score, scoreReason: record.scoreReason || `历史记录 · ${record.company || record.bossName}` });
          setStatus('ready'); setCollapsed(false); setPageMode('history');
          await copyText(record.greeting); setCopied(true);
          beginPoll(record.greeting);
        }
      } catch {}
    })();
    return stopPoll;
  }, []);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setCollapsed(false); setDebug('⏳ 分析中...');
    setStatus('loading'); setResult(null); setCopied(false);
    setAutoFilled(false); autoFilledRef.current = false; stopPoll();

    try {
      const { extractJD, extractCompany, extractJobTitle, extractBossName } = await import('@/lib/jd-extractor');
      const jdText = extractJD();
      if (!jdText) { setDebug('❌ 未检测到职位描述'); setStatus('error'); return; }

      const company = extractCompany();
      const title = extractJobTitle();
      const boss = extractBossName();
      setCurrentCompany(company); setCurrentTitle(title); setCurrentBoss(boss);
      setDebug(`⏳ 分析匹配度... (${company || '?'} · ${title || '?'})`);

      await doGenerate(jdText, focus, company, title, boss);
      track('greeting_button_clicked', { focus });
    } catch (err) {
      setDebug('❌ ' + (err instanceof Error ? err.message : '网络错误'));
      setStatus('error');
    }
  }, [stopPoll, doGenerate]);

  const handleRegenerate = useCallback(async (focus: FocusOption = 'none') => {
    stopPoll(); setRegenerating(true); setDebug('⏳ 重新生成中...');
    try {
      const record = await findMatch(currentCompany, currentTitle, currentBoss);
      if (!record?.jdText) { setDebug('❌ 未找到缓存的 JD'); setRegenerating(false); return; }
      const r = await doGenerate(record.jdText, focus, currentCompany, currentTitle, currentBoss);
      if (r) await updateRecord(currentCompany, currentTitle, currentBoss, { greeting: r.greeting, score: r.score, scoreReason: r.scoreReason, time: Date.now() });
    } catch (err) {
      setDebug('❌ ' + (err instanceof Error ? err.message : '网络错误'));
    } finally { setRegenerating(false); }
  }, [currentCompany, currentTitle, currentBoss, stopPoll, doGenerate]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await copyText(result.greeting); setCopied(true);
    showToast('✅ 已复制', 'success');
  }, [result, showToast]);

  const handleManualFill = useCallback(() => {
    if (!result) return;
    const input = findInputAnywhere();
    if (input && doFill(input, result.greeting)) {
      stopPoll(); autoFilledRef.current = true; setAutoFilled(true); setDebug('');
      showToast('✅ 已填入', 'success');
    } else { handleCopy(); }
  }, [result, handleCopy, stopPoll, showToast]);

  const hasInput = findInputAnywhere() !== null;

  if (collapsed) {
    return <button onClick={() => setCollapsed(false)} style={{ width: 40, height: 40, borderRadius: '50%', background: '#5ebb8a', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</button>;
  }

  const s = result?.score ?? -1;
  const valid = s >= 0;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          招呼语助手{pageMode === 'history' ? ' · 历史记录' : ''}
        </span>
        <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, color: '#9ca3af', fontSize: 11, cursor: 'pointer', padding: '1px 8px' }}>收起</button>
      </div>

      {pageMode === 'generate' && (
        <GreetingButton onGenerate={handleGenerate} loading={status === 'loading'} disabled={needsSetup} disabledReason={needsSetup ? '请先设置 API Key' : undefined} />
      )}

      {pageMode === 'history' && (
        <button onClick={() => handleRegenerate('none')} disabled={regenerating || needsSetup} style={{
          padding: '6px 14px', border: '1px solid #f59e0b', borderRadius: 6,
          background: regenerating ? '#fffbeb' : '#fff', color: regenerating ? '#d97706' : '#f59e0b',
          fontSize: 13, fontWeight: 500, cursor: needsSetup ? 'not-allowed' : 'pointer',
          opacity: needsSetup ? 0.5 : 1, marginBottom: 8,
        }}>{regenerating ? '⏳ 重新生成中...' : '🔄 重新生成招呼语'}</button>
      )}

      {debug && <div style={{ fontSize: 12, marginTop: 4, maxWidth: 300, lineHeight: 1.4, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: debug.startsWith('❌') ? '#dc2626' : '#2563eb' }}>{debug}</div>}

      {result && status === 'ready' && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 8, maxWidth: 340, background: '#fff', border: '1px solid #e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: valid ? (s >= 80 ? '#f0fdf4' : s >= 60 ? '#fffbeb' : '#fef2f2') : '#f9fafb' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>匹配度</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: scoreColor(s), lineHeight: 1 }}>{valid ? s : '—'}</span>
            {valid && <span style={{ fontSize: 12, color: '#9ca3af' }}>/100</span>}
            {valid && <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}><div style={{ width: `${s}%`, height: '100%', borderRadius: 3, background: scoreColor(s), transition: 'width 0.5s' }} /></div>}
          </div>
          {result.scoreReason && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.5, padding: '6px 8px', borderRadius: 4, background: '#f9fafb' }}>💡 {result.scoreReason}</div>}
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f2937', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{result.greeting}</div>
          {autoFilled ? (
            <div style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', textAlign: 'center', background: '#f0fdf4', color: '#16a34a' }}>✅ 已自动填入聊天框</div>
          ) : hasInput ? (
            <button onClick={handleManualFill} style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff' }}>📝 一键填入</button>
          ) : (
            <button onClick={handleCopy} style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: copied ? '#16a34a' : '#22c55e', color: '#fff' }}>{copied ? '✅ 已复制 — Ctrl+V 粘贴' : '📋 复制招呼语'}</button>
          )}
        </div>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

function findInputAnywhere(): HTMLElement | null {
  let el = findInput(document); if (el) return el;
  for (const iframe of document.querySelectorAll('iframe')) { try { const doc = iframe.contentDocument || iframe.contentWindow?.document; if (doc) { el = findInput(doc); if (el) return el; } } catch {} }
  return null;
}
function findInput(doc: Document): HTMLElement | null { for (const el of doc.querySelectorAll('textarea, [contenteditable="true"]')) { const he = el as HTMLElement; if (he.offsetHeight > 20 && he.offsetWidth > 50) return he; } return null; }
function getInputValue(el: HTMLElement): string { if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value; return el.textContent || ''; }
function doFill(el: HTMLElement, text: string): boolean { try { el.focus(); if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) { const ns = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set; if (ns) ns.call(el, text); else el.value = text; } else { el.textContent = ''; document.execCommand('insertText', false, text); } el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; } catch { return false; } }
async function copyText(text: string): Promise<boolean> { try { await navigator.clipboard.writeText(text); return true; } catch {} try { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; } catch { return false; } }
