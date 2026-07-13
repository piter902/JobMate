import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/storage';
import { parseResume } from '@/lib/resume-parser';

export function SettingsForm() {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeLength, setResumeLength] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      const key = await storage.getApiKey();
      if (key) { setMaskedKey(key.slice(0, 8) + '...' + key.slice(-4)); setApiKey(key); }
      const { text, fileName } = await storage.getResume();
      if (fileName) setResumeFileName(fileName);
      if (text) setResumeLength(text.length);
    })();
  }, []);

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) { setMessage({ text: '请输入 API Key', type: 'error' }); return; }
    setSaving(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'VALIDATE_API_KEY', apiKey: apiKey.trim() });
      if (response.valid) {
        await storage.setApiKey(apiKey.trim());
        setMaskedKey(apiKey.trim().slice(0, 8) + '...' + apiKey.trim().slice(-4));
        setMessage({ text: 'API Key 验证成功', type: 'success' });
      } else {
        setMessage({ text: 'API Key 验证失败', type: 'error' });
      }
    } catch { setMessage({ text: '验证失败，请检查网络', type: 'error' }); }
    finally { setSaving(false); }
  }, [apiKey]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setParsing(true); setMessage(null);
    try {
      const result = await parseResume(file);
      await storage.setResume(result.text, result.fileName);
      setResumeFileName(result.fileName); setResumeLength(result.text.length);
      setMessage({ text: `简历解析成功（${result.text.length} 字符）`, type: 'success' });
    } catch (err) {
      setMessage({ text: (err as Error).message || '解析失败', type: 'error' });
    } finally { setParsing(false); }
  }, []);

  const handleClearResume = useCallback(async () => {
    await storage.clearResume();
    setResumeFileName(''); setResumeLength(0);
    setMessage({ text: '简历已清除', type: 'success' });
  }, []);

  return (
    <div style={{ width: 360, padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 14, color: '#374151' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>🤖 智能招呼语助手</h1>

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
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>我的简历</h2>
        {resumeFileName ? (
          <div style={{ padding: 10, background: '#f0faf5', borderRadius: 6, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13 }}>📄 {resumeFileName}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{resumeLength} 字符</p>
            <button onClick={handleClearResume} style={{ marginTop: 6, padding: '4px 10px', background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>清除</button>
          </div>
        ) : (
          <label style={{ display: 'block', padding: 20, border: '2px dashed #d1d5db', borderRadius: 8, textAlign: 'center', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
            {parsing ? '解析中...' : '📎 点击上传 PDF 或 DOCX 简历'}
            <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={parsing} style={{ display: 'none' }} />
          </label>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>使用方法</h2>
        <ol style={{ fontSize: 12, color: '#6b7280', paddingLeft: 18, lineHeight: 1.8 }}>
          <li>打开 Boss直聘任意职位详情页</li>
          <li>点击右上角招呼语助手按钮</li>
          <li>选择侧重点即可生成招呼语</li>
          <li>点击复制后 Ctrl+V 粘贴到聊天框</li>
        </ol>
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
