import { extractCurrentJD } from '@/lib/jd-extractor';
import { useState, useCallback, useEffect, useRef } from 'react';
import { GreetingButton } from './GreetingButton';
import { Toast, useToast } from './Toast';
import type { FocusOption, GreetingResult, GenerateGreetingResponse } from '@/lib/types';
import { track } from '@/lib/analytics';
import { saveGreeting, findMatch } from '@/lib/history';

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

function getPageText(): string {
  const result = extractCurrentJD();
  if (result.status !== 'valid') throw new Error(result.reason);
  return result.text;
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
  const [lookingUp, setLookingUp] = useState(false);
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

  // 用已知 JD 生成招呼语（不重新提取页面）
  const generateWithJD = useCallback(async (jdText: string, focus: FocusOption, company: string, title: string, boss: string) => {
    const response = (await chrome.runtime.sendMessage({
      type: 'GENERATE_GREETING', jdText, focus,
    })) as GenerateGreetingResponse;
    if (response.error) throw new Error(response.error);
    return response.result!;
  }, []);

  const lookupCache = useCallback(async () => {
    setLookingUp(true); setDebug('🔍 查找缓存...');
    try {
      const { extractCompany, extractJobTitle } = await import('@/lib/jd-extractor');
      const company = extractCompany();
      const title = extractJobTitle();
      setCurrentCompany(company); setCurrentTitle(title);

      if (!company || !title) { setDebug('未识别到公司或岗位信息'); setLookingUp(false); return; }

      // 1. 查缓存 → 有就直出
      const record = await findMatch(company, title);
      if (record) {
        setResult({ greeting: record.greeting, score: record.score, scoreReason: record.scoreReason || `${record.company} · ${record.jobTitle}` });
        setStatus('ready'); setCollapsed(false); setPageMode('history');
        await copyText(record.greeting); setCopied(true);
        beginPoll(record.greeting);
        setDebug(`✅ 缓存匹配 · ${record.company} · ${record.jobTitle}`);
        setLookingUp(false);
        return;
      }

      // 2. 无缓存招呼语 → 查该公司的历史 JD，用 JD 重新生成
      setDebug('⏳ 无缓存，查找历史JD...');
      const allRecords = await import('@/lib/history').then(m => m.loadAll());
      const jdRecord = allRecords.find(r =>
        r.company.trim() === company.trim() && r.jdText.trim().length > 20,
      );
      if (jdRecord) {
        setDebug('⏳ 找到历史JD，生成中...');
        const genRes = (await chrome.runtime.sendMessage({
          type: 'GENERATE_GREETING', jdText: jdRecord.jdText, focus: 'none' as FocusOption,
        })) as GenerateGreetingResponse;
        if (genRes.error) { setDebug('❌ ' + genRes.error); setLookingUp(false); return; }

        const r = genRes.result!;
        setResult(r); setStatus('ready'); setCollapsed(false); setPageMode('history');
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(r)); } catch {}
        await saveGreeting({
          company, jobTitle: title, bossName: jdRecord.bossName,
          jdText: jdRecord.jdText, greeting: r.greeting, score: r.score,
          scoreReason: r.scoreReason, time: Date.now(),
        });
        await copyText(r.greeting); setCopied(true);
        beginPoll(r.greeting);
        setDebug(`✅ 已生成 · ${company} · ${title}`);
      } else {
        setDebug('❌ 无缓存JD，请先到职位详情页生成一次');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setDebug(msg.includes('Extension context invalidated') ? '⚠ 请刷新Boss页面' : '❌ ' + (msg || '查找失败'));
    } finally { setLookingUp(false); }
  }, [beginPoll]);

  useEffect(() => {
    (async () => {
      try {
        chrome.storage.local.get('deepseekApiKey').then((r) => setNeedsSetup(!r.deepseekApiKey));
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) { setResult(JSON.parse(cached)); setStatus('ready'); setCollapsed(false); setPageMode('generate'); beginPoll(JSON.parse(cached).greeting); return; }
      } catch {}
    })();

    // 监听简历切换 → 清除缓存的招呼语
    const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes['selectedResumeId']) {
        sessionStorage.removeItem(CACHE_KEY);
        setResult(null); setStatus('idle'); setDebug('');
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);

    return () => {
      stopPoll();
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, []);

  const handleGenerate = useCallback(async (focus: FocusOption) => {
    setCollapsed(false); setDebug('⏳ LLM 分析页面...');
    setStatus('loading'); setResult(null); setCopied(false);
    setAutoFilled(false); autoFilledRef.current = false; stopPoll();

    try {
      const pageText = getPageText();
      if (!pageText.trim()) { setDebug('❌ 页面无内容'); setStatus('error'); return; }

      // 第一步：LLM 提取 + 生成
      const response = await chrome.runtime.sendMessage({
        type: 'EXTRACT_AND_GENERATE', pageText, focus,
      }) as {
        type: string;
        result?: { company: string; jobTitle: string; bossName: string; jdText: string; greeting: string; score: number; scoreReason: string };
        error?: string;
      };

      if (response.error) { setDebug('❌ ' + response.error); setStatus('error'); return; }

      let r = response.result!;
      let fromCache = false;

      // 第二步：如果 LLM 没提取到 JD，从本地缓存补
      if (!r.jdText || r.jdText.trim().length < 20) {
        setDebug('⏳ 页面无JD，从本地缓存查找...');
        const record = await findMatch(r.company, r.jobTitle);
        if (record?.jdText) {
          setDebug('⏳ 找到缓存JD，重新生成...');
          const cachedResult = await generateWithJD(record.jdText, focus, r.company, r.jobTitle, r.bossName);
          r = { ...r, greeting: cachedResult.greeting, score: cachedResult.score, scoreReason: cachedResult.scoreReason, jdText: record.jdText };
          fromCache = true;
        }
      }

      // 如果仍然没有 JD 和招呼语
      if (!r.greeting) { setDebug('❌ 无法获取JD，请在有JD的页面先生成一次'); setStatus('error'); return; }

      setCurrentCompany(r.company); setCurrentTitle(r.jobTitle); setCurrentBoss(r.bossName);
      setResult({ greeting: r.greeting, score: r.score, scoreReason: r.scoreReason });
      setDebug(`✅ ${r.company || r.bossName} · ${r.jobTitle}${fromCache ? ' (缓存JD)' : ''}`);
      setStatus('ready');
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ greeting: r.greeting, score: r.score, scoreReason: r.scoreReason })); } catch {}

      try {
        if (r.company && r.jobTitle && r.company !== r.jobTitle) {
          await saveGreeting({
            company: r.company, jobTitle: r.jobTitle, bossName: r.bossName,
            jdText: r.jdText, greeting: r.greeting, score: r.score,
            scoreReason: r.scoreReason, time: Date.now(),
          });
        }
      } catch {}

      track('greeting_button_clicked', { focus });
      await copyText(r.greeting); setCopied(true);
      beginPoll(r.greeting);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setDebug(msg.includes('Extension context invalidated') ? '⚠ 请刷新Boss页面' : '❌ ' + (msg || '网络错误'));
      setStatus('error');
    }
  }, [stopPoll, beginPoll, generateWithJD]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await copyText(result.greeting); setCopied(true);
    showToast('✅ 已复制', 'success');
  }, [result, showToast]);

  if (collapsed) {
    return <button onClick={() => setCollapsed(false)} style={{ width: 40, height: 40, borderRadius: '50%', background: '#5ebb8a', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💼</button>;
  }

  const s = result?.score ?? -1;
  const valid = s >= 0;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>JobMate{pageMode === 'history' ? ' · 历史' : ''}</span>
        <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, color: '#9ca3af', fontSize: 11, cursor: 'pointer', padding: '1px 8px' }}>收起</button>
      </div>

      <GreetingButton onGenerate={handleGenerate} loading={status === 'loading'} disabled={needsSetup} disabledReason={needsSetup ? '请先设置 API Key' : undefined} />
      <div style={{ marginTop: 4 }}>
        <button onClick={lookupCache} disabled={lookingUp || needsSetup} style={{
          background: 'none', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer',
          padding: 0, textDecoration: 'underline', textUnderlineOffset: 3,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          opacity: needsSetup ? 0.5 : 1,
        }}>{lookingUp ? '查找中...' : '查历史招呼语 →'}</button>
      </div>

      {debug && <div style={{ fontSize: 12, marginTop: 4, maxWidth: 300, lineHeight: 1.4, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: debug.startsWith('❌') ? '#dc2626' : debug.startsWith('✅') ? '#16a34a' : '#2563eb' }}>{debug}</div>}

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
            <button onClick={handleCopy} style={{ width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: copied ? '#16a34a' : '#22c55e', color: '#fff' }}>{copied ? '✅ 已复制 — Ctrl+V 粘贴' : '📋 复制招呼语'}</button>
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
