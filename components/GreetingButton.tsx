import { useState, useRef, useEffect } from 'react';
import type { FocusOption } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';

interface GreetingButtonProps {
  onGenerate: (focus: FocusOption) => void;
  loading: boolean;
  disabled: boolean;
  disabledReason?: string;
}

export function GreetingButton({ onGenerate, loading, disabled, disabledReason }: GreetingButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const focusOptions: FocusOption[] = ['none', 'skills', 'experience', 'projects'];

  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button
        onClick={() => onGenerate('none')}
        disabled={disabled || loading}
        title={disabled ? disabledReason : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0 16px', height: 36,
          border: '1px solid #5ebb8a', borderRadius: '4px 0 0 4px',
          background: loading ? '#f0faf5' : '#5ebb8a',
          color: loading ? '#5ebb8a' : '#fff',
          fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {loading ? '⏳ 生成中...' : '🤖 生成招呼语'}
      </button>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          height: 36, width: 28,
          border: '1px solid #5ebb8a', borderLeft: 'none',
          borderRadius: '0 4px 4px 0',
          background: loading ? '#f0faf5' : '#fff',
          color: '#5ebb8a', fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        ▼
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 2147483647,
          minWidth: 160, overflow: 'hidden',
        }}>
          {focusOptions.map((opt) => (
            <div
              key={opt}
              onClick={() => { setOpen(false); onGenerate(opt); }}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 14,
                color: '#374151', borderBottom: '1px solid #f3f4f6',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f0faf5'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              {FOCUS_LABELS[opt]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
