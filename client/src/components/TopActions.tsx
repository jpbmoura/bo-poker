import { useEffect, useRef, useState } from 'react';
import { LogOut, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';
import { TrainerDialog } from './TrainerDialog';
import { segmentFraction } from './TrainerProgressBits';
import { useTrainer } from '../hooks/useTrainer';
import type { SerializedPlayer } from '../types';

interface TopActionsProps {
  me: SerializedPlayer | null;
  onSignOut: () => void;
}

export function TopActions({ me, onSignOut }: TopActionsProps) {
  const [open, setOpen] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { active } = useTrainer();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // O progresso vem do estado da MESA (que já chega por socket) e cai no da
  // conta antes de entrar na sala.
  const progress = me?.progress ?? active?.progress ?? null;
  const fraction = progress ? segmentFraction(progress) : 0;
  const sprite = me?.pokemon.sprite || active?.form.sprite || '';
  const speciesName = me?.pokemon.name || active?.form.name || '';

  return (
    <>
      <div className="fixed top-4 right-4 z-20 animate-fade-in" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'relative w-14 h-14 rounded-full flex items-center justify-center',
            'border-2 border-border bg-surface-2 p-1.5',
            'hover:border-border-strong transition-all duration-200 active:scale-95',
            open && 'border-border-strong shadow-[0_0_0_3px_rgba(255,255,255,0.06)]',
          )}
          title={me?.name ?? ''}
        >
          {/* Anel de progresso até o próximo estágio, em volta do avatar. */}
          {progress && (
            <span
              aria-hidden
              className="absolute -inset-[3px] rounded-full"
              style={{
                background: `conic-gradient(var(--brand) ${fraction * 360}deg, transparent 0deg)`,
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
                WebkitMask:
                  'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              }}
            />
          )}
          {sprite ? (
            <img
              src={sprite}
              alt=""
              className="relative w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
            />
          ) : (
            <PokeballIcon size={20} className="text-muted" />
          )}
        </button>

        {open && me && (
          <div className="absolute right-0 top-16 min-w-[230px] bg-surface border border-border rounded-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] p-4 animate-fade-up">
            <div className="text-[10px] uppercase tracking-[0.18em] text-subtle mb-1.5">
              Você
            </div>
            <div className="text-sm text-text font-medium truncate">{me.name}</div>
            {me.login && (
              <div className="text-xs text-subtle font-mono truncate">@{me.login}</div>
            )}
            {speciesName && (
              <div className="text-xs text-muted capitalize">{speciesName}</div>
            )}
            {progress && (
              <div className="mt-1 text-[11px] font-mono text-subtle">
                {progress.xp} XP
                {progress.nextXp !== null &&
                  ` · faltam ${Math.max(0, progress.nextXp - progress.xp)}`}
              </div>
            )}

            <button
              onClick={() => {
                setOpen(false);
                setTrainerOpen(true);
              }}
              className="mt-3 w-full flex items-center gap-2 px-2.5 py-2 -mx-0.5 rounded-lg text-xs text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <Sparkles size={13} />
              Meus Pokémon
            </button>

            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-2.5 py-2 -mx-0.5 rounded-lg text-xs text-muted hover:text-danger hover:bg-danger-soft transition-colors"
            >
              <LogOut size={13} />
              Sair da conta
            </button>
          </div>
        )}
      </div>

      <TrainerDialog open={trainerOpen} onClose={() => setTrainerOpen(false)} />
    </>
  );
}
