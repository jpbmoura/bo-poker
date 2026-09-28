import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Rótulo para leitores de tela. */
  label: string;
}

/**
 * Painel lateral direito. Mesma API do `Dialog`, mas sempre dispensável (Esc ou
 * clique no fundo) — é um painel de consulta, não uma decisão obrigatória.
 */
export function Drawer({ open, onClose, children, className, label }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            className={cn(
              'absolute right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border shadow-[-24px_0_60px_-12px_rgba(0,0,0,0.6)] flex flex-col',
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
