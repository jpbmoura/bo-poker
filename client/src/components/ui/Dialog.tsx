import { ReactNode, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  dismissable?: boolean;
}

export function Dialog({ open, onClose, children, className, dismissable = false }: DialogProps) {
  useEffect(() => {
    if (!open || !dismissable || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-border shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
