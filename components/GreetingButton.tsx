import { useState } from 'react';
import type { FocusOption } from '@/lib/types';
import { FOCUS_LABELS } from '@/lib/types';

interface GreetingButtonProps {
  onGenerate: (focus: FocusOption) => void;
  loading: boolean;
  disabled: boolean;
  disabledReason?: string;
}

const OPTIONS: FocusOption[] = ['none', 'skills', 'experience', 'projects'];

export function GreetingButton({ onGenerate, loading, disabled, disabledReason }: GreetingButtonProps) {
  const [selected, setSelected] = useState<FocusOption>('none');
  const [showHint, setShowHint] = useState(false);

  const handleClick = (opt: FocusOption) => {
    if (disabled) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 3000);
      return;
    }
    setSelected(opt);
    onGenerate(opt);
  };

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', gap: 6,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>生成招呼语</span>
        {disabled && disabledReason && (
          <span style={{ fontSize: 11, color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: 4 }}>
            {disabledReason}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          const isThisLoading = isSelected && loading;
          return (
            <button
              key={opt}
              aria-pressed={isSelected}
              onClick={() => handleClick(opt)}
              disabled={disabled || loading}
              style={{
                padding: '6px 12px',
                border: isSelected && !disabled ? '1px solid #5ebb8a' : '1px solid #d1d5db',
                borderRadius: 6,
                background: isSelected && !disabled ? '#5ebb8a' : '#fff',
                color: isSelected && !disabled ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: isSelected && !disabled ? 600 : 400,
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {isThisLoading ? '⏳ ' : ''}{FOCUS_LABELS[opt]}
            </button>
          );
        })}
      </div>
      {showHint && disabledReason && (
        <div style={{
          fontSize: 12, color: '#dc2626', background: '#fef2f2',
          padding: '6px 10px', borderRadius: 6, maxWidth: 280,
        }}>
          💡 {disabledReason}，请点击右上角插件图标进行设置
        </div>
      )}
    </div>
  );
}
