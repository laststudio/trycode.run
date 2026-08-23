import { useEffect } from 'react';
import { useUIStore } from '../../stores';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const COLORS: Record<keyof typeof ICONS, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-sky-500',
};

function ToastItem({ id }: { id: string }) {
  const toast = useUIStore((s) => s.toasts.find((t) => t.id === id));
  const removeToast = useUIStore((s) => s.removeToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => removeToast(toast.id),
      toast.duration ?? (toast.type === 'error' ? 6000 : 3500)
    );
    return () => clearTimeout(timer);
  }, [toast, removeToast]);

  if (!toast) return null;

  const Icon = ICONS[toast.type] ?? Info;
  const color = COLORS[toast.type] ?? COLORS.info;

  return (
    <div
      role="alert"
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 animate-in slide-in-from-right"
    >
      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400 break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} />
      ))}
    </div>
  );
}
