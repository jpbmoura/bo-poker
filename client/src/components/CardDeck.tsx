import { AnimationEvent, useState } from 'react';
import { cn } from '../utils/cn';
import type { CardValue } from '../types';

interface CardDeckProps {
  sequence: CardValue[];
  selected: CardValue | null;
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function CardDeck({ sequence, selected, disabled, onSelect }: CardDeckProps) {
  const [picking, setPicking] = useState<CardValue | null>(null);

  const handleSelect = (value: CardValue) => {
    if (disabled) return;
    if (selected === value && picking === null) return;
    setPicking(value);
    onSelect(value);
  };

  const handleAnimationEnd = (value: CardValue, e: AnimationEvent<HTMLButtonElement>) => {
    if (e.animationName === 'card-pick' && picking === value) {
      setPicking(null);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 animate-fade-up">
      {sequence.map((value, idx) => {
        const isSelected = selected === value;
        const isPicking = picking === value;
        const isSymbol = value === '?';
        const isDimmed = selected !== null && !isSelected && !isPicking;

        const selectedShadow =
          'shadow-[0_0_0_2px_var(--text),0_22px_50px_-12px_rgba(255,255,255,0.42)]';

        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(value)}
            onAnimationEnd={(e) => handleAnimationEnd(value, e)}
            style={{ animationDelay: `${idx * 30}ms` }}
            className={cn(
              'group relative w-16 h-24 rounded-lg border bg-surface-2 flex items-center justify-center',
              'will-change-transform animate-fade-up',
              !isPicking &&
                'transition-[transform,box-shadow,opacity,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              !disabled && !isSelected && !isPicking &&
                'hover:-translate-y-1.5 hover:bg-surface-3 cursor-pointer active:scale-[0.96] active:translate-y-0',
              disabled && !isSelected && 'opacity-30 cursor-not-allowed',
              isDimmed && !disabled && 'opacity-60',
              isPicking && `animate-card-pick border-text bg-surface-3 ${selectedShadow}`,
              isSelected && !isPicking &&
                `animate-selected-float border-text bg-surface-3 ${selectedShadow} z-10`,
              !isSelected && !isPicking && 'border-border hover:border-border-strong',
            )}
          >
            {isSelected && !isPicking && (
              <span
                aria-hidden
                className="absolute -inset-2 rounded-2xl bg-text/15 blur-xl animate-selected-halo pointer-events-none -z-10"
              />
            )}

            <span
              className={cn(
                'text-2xl font-mono font-medium transition-colors duration-200',
                isSelected || isPicking ? 'text-text' : 'text-muted group-hover:text-text',
                isSymbol && 'font-sans text-xl',
              )}
            >
              {value}
            </span>

            {isSelected && !isPicking && (
              <>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.18em] font-mono font-semibold text-text whitespace-nowrap animate-fade-in">
                  Sua carta
                </span>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-text shadow-[0_0_10px_var(--text)]" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
