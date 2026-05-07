import { useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';
import type { SerializedPlayer } from '../types';

interface TopActionsProps {
  me: SerializedPlayer | null;
}

export function TopActions({ me }: TopActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="fixed top-4 right-4 z-20 animate-fade-in" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-14 h-14 rounded-full overflow-hidden flex items-center justify-center',
          'border-2 border-border bg-surface-2 p-1.5',
          'hover:border-border-strong transition-all duration-200 active:scale-95',
          open && 'border-border-strong shadow-[0_0_0_3px_rgba(255,255,255,0.06)]',
        )}
        title={me?.name ?? ''}
      >
        {me?.pokemon.sprite ? (
          <img
            src={me.pokemon.sprite}
            alt=""
            className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          />
        ) : (
          <PokeballIcon size={20} className="text-muted" />
        )}
      </button>

      {open && me && (
        <div className="absolute right-0 top-16 min-w-[200px] bg-surface border border-border rounded-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] p-4 animate-fade-up">
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle mb-1.5">
            Você
          </div>
          <div className="text-sm text-text font-medium truncate">{me.name}</div>
          <div className="text-xs text-muted capitalize">{me.pokemon.name}</div>
        </div>
      )}
    </div>
  );
}
