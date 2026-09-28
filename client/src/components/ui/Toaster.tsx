import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../../store/useToastStore';
import { cn } from '../../utils/cn';
import { enter, exit, springSnappy } from '../../lib/motion';

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ICON_CLASS: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-muted',
};

/** Montado uma vez no App. z-[60]: acima de Dialog (z-50) e Drawer. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col items-end gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: enter }}
              exit={{ opacity: 0, scale: 0.97, transition: exit }}
              transition={springSnappy}
              className={cn(
                'pointer-events-auto w-full sm:w-auto sm:max-w-sm flex items-start gap-2.5',
                'pl-3.5 pr-2 py-2.5 rounded-xl bg-surface-2/95 backdrop-blur border shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]',
                t.kind === 'error' ? 'border-danger/30' : 'border-border-strong',
              )}
            >
              <Icon size={16} className={cn('mt-px shrink-0', ICON_CLASS[t.kind])} />
              <span className="text-[13px] leading-snug text-text flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar aviso"
                className="shrink-0 -my-0.5 w-6 h-6 rounded-md flex items-center justify-center text-subtle hover:text-text hover:bg-surface-3 transition-colors"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
