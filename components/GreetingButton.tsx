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

  const handleClick = (opt: FocusOption) => {
    setSelected(opt);
    onGenerate(opt);
  };

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', gap: 6,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      userSelect: 'none',
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>生成招呼语</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          const isThisLoading = isSelected && loading;
          return (
            <button
              key={opt}
              onClick={() => handleClick(opt)}
              disabled={disabled || loading}
              title={disabled ? disabledReason : undefined}
              style={{
                padding: '6px 12px',
                border: isSelected ? '2px solid #5ebb8a' : '1px solid #d1d5db',
                borderRadius: 6,
                background: isSelected ? '#5ebb8a' : '#fff',
                color: isSelected ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
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
    </div>
  );
}
