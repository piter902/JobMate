import { useState, useEffect, useCallback } from 'react';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastState | null;
  onDone: () => void;
}

export function Toast({ toast, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDone, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDone]);

  if (!toast) return null;

  const bgColor =
    toast.type === 'success' ? '#16a34a' :
    toast.type === 'error' ? '#dc2626' : '#2563eb';

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 2147483647,
      background: bgColor, color: '#fff', padding: '10px 18px',
      borderRadius: 8, fontSize: 14,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s',
      pointerEvents: 'none',
    }}>
      {toast.message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback(
    (message: string, type: ToastState['type'] = 'info') => setToast({ message, type }),
    [],
  );
  const clearToast = useCallback(() => setToast(null), []);
  return { toast, showToast, clearToast };
}
