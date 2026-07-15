import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/storage';
import type { ResumeItem } from '@/lib/storage';
import { parseResume } from '@/lib/resume-parser';

const FEISHU_URL = 'https://scnanhq8rwck.feishu.cn/wiki/DkScwkZiKigkgBkprZncGHpFnpe';

export function SettingsForm() {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    const key = await storage.getApiKey();
    if (key) { setMaskedKey(key.slice(0, 8) + '...' + key.slice(-4)); setApiKey(key); }
    const list = await storage.getResumes();
    setResumes(list);
    const sel = await storage.getSelectedResumeId();
    setSelectedId(sel || list[0]?.id || '');
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) { setMessage({ text: '请输入 API Key', type: 'error' }); return; }
    setSaving(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'VALIDATE_API_KEY', apiKey: apiKey.trim() });
      if (response.valid) {
        await storage.setApiKey(apiKey.trim());
        setMaskedKey(apiKey.trim().slice(0, 8) + '...' + apiKey.trim().slice(-4));
        setMessage({ text: 'API Key 验证成功', type: 'success' });
      } else { setMessage({ text: 'API Key 验证失败', type: 'error' }); }
    } catch { setMessage({ text: '验证失败，请检查网络', type: 'error' }); }
    finally { setSaving(false); }
  }, [apiKey]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setParsing(true); setMessage(null);
    try {
      const result = await parseResume(file);
      await storage.addResume(result.text, result.fileName);
      await load();
      setMessage({ text: `"${result.fileName}" 上传成功`, type: 'success' });
    } catch (err) {
      setMessage({ text: (err as Error).message || '解析失败', type: 'error' });
    } finally { setParsing(false); }
  }, [load]);

  const handleSelect = useCallback(async (id: string) => {
    await storage.selectResume(id); setSelectedId(id);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    await storage.removeResume(id); await load();
  }, [load]);

  return (
    <div style={{ width: '100%', padding: 20, boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 14, color: '#374151' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>🤖 JobMate</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>DeepSeek API Key</h2>
        {maskedKey && <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>当前: {maskedKey}</p>}
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={handleSaveKey} disabled={saving} style={{
          marginTop: 8, padding: '8px 16px', background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1,
        }}>{saving ? '验证中...' : '保存并验证'}</button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>我的简历（可多份）</h2>
        {resumes.map((r) => (
          <div key={r.id} onClick={() => handleSelect(r.id)} style={{
            padding: 10, borderRadius: 6, marginBottom: 6, cursor: 'pointer',
            background: r.id === selectedId ? '#f0faf5' : '#f9fafb',
            border: r.id === selectedId ? '2px solid #5ebb8a' : '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: r.id === selectedId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.id === selectedId ? '✅ ' : '📄 '}{r.fileName}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{r.text.length} 字符</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleRemove(r.id); }} style={{
              background: 'none', border: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer', padding: '0 4px',
            }}>×</button>
          </div>
        ))}
        <label style={{ display: 'block', padding: 14, border: '2px dashed #d1d5db', borderRadius: 8, textAlign: 'center', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
          {parsing ? '⏳ 解析中...' : '＋ 上传 PDF 或 DOCX 简历'}
          <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={parsing} style={{ display: 'none' }} />
        </label>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>联系作者</h2>
        <div style={{ textAlign: 'center' }}>
          <img src={chrome.runtime.getURL('qrcode.png')} alt="微信二维码" style={{
            width: 160, height: 160, borderRadius: 8, border: '1px solid #e5e7eb',
          }} />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>扫码添加微信</p>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <a href={FEISHU_URL} target="_blank" style={{
          display: 'block', padding: 10, borderRadius: 6, background: '#f0f4ff',
          color: '#2563eb', fontSize: 13, textDecoration: 'none', textAlign: 'center',
          border: '1px solid #dbeafe',
        }}>📖 使用文档</a>
      </section>

      {message && (
        <div style={{ marginTop: 16, padding: '8px 12px', borderRadius: 6,
          background: message.type === 'success' ? '#f0faf5' : '#fef2f2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626', fontSize: 13 }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
