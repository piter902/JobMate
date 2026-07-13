import type { FocusOption } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';

interface GreetingButtonProps {
  onGenerate: (focus: FocusOption) => void;
  loading: boolean;
  disabled: boolean;
  disabledReason?: string;
}

const FOCUS_OPTIONS: FocusOption[] = ['none', 'skills', 'experience', 'projects'];

export function GreetingButton({ onGenerate, loading, disabled, disabledReason }: GreetingButtonProps) {
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', gap: 4,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <button
        onClick={() => onGenerate('none')}
        disabled={disabled || loading}
        title={disabledReason}
        style={{
          padding: '6px 14px', border: '2px solid #5ebb8a',
          borderRadius: 6, background: loading ? '#f0faf5' : '#5ebb8a',
          color: loading ? '#5ebb8a' : '#fff', fontSize: 14, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
        }}
      >
        {loading ? '⏳ 生成中...' : '🤖 生成招呼语'}
      </button>
      {!disabled && (
        <div style={{ display: 'flex', gap: 4 }}>
          {FOCUS_OPTIONS.filter(o => o !== 'none').map((opt) => (
            <button
              key={opt}
              onClick={() => onGenerate(opt)}
              disabled={loading}
              style={{
                padding: '3px 8px', border: '1px solid #d1d5db',
                borderRadius: 4, background: '#fff', color: '#6b7280',
                fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1, whiteSpace: 'nowrap',
              }}
            >
              {FOCUS_LABELS[opt].replace('侧重', '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
