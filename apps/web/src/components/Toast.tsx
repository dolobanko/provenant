import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

let _toastFn: ((message: string, type?: ToastType) => void) | null = null;

/** Imperative helper — usable outside React components */
export const toast = {
  show: (message: string, type: ToastType = 'info') => _toastFn?.(message, type),
  success: (message: string) => _toastFn?.(message, 'success'),
  error: (message: string) => _toastFn?.(message, 'error'),
  info: (message: string) => _toastFn?.(message, 'info'),
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
};

const bg: Record<ToastType, string> = {
  success: 'bg-gray-900 border-green-800',
  error: 'bg-gray-900 border-red-800',
  info: 'bg-gray-900 border-gray-700',
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose imperative API
  _toastFn = add;

  const value: ToastContextValue = {
    toast: add,
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '360px' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl pointer-events-auto',
              'animate-in slide-in-from-right-4 fade-in duration-200',
              bg[t.type],
            )}
          >
            {icons[t.type]}
            <span className="flex-1 text-sm text-gray-200">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
