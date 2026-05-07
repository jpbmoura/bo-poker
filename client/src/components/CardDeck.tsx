import { useState } from 'react';
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
    setPicking(value);
    onSelect(value);
    window.setTimeout(
      () => setPicking((curr) => (curr === value ? null : curr)),
      480,
    );
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 animate-fade-up">
      {sequence.map((value, idx) => {
        const isSelected = selected === value;
        const isPicking = picking === value;
        const isSymbol = value === '?';

        const selectedDestaque =
          'border-text bg-surface-3 shadow-[0_0_0_2px_var(--text),0_18px_40px_-12px_rgba(255,255,255,0.32)]';

        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(value)}
            style={{ animationDelay: `${idx * 30}ms` }}
            className={cn(
              'group relative w-16 h-24 rounded-lg border bg-surface-2 flex items-center justify-center',
              'animate-fade-up',
              !isPicking && 'transition-all duration-200 ease-out',
              !disabled && !isSelected && !isPicking &&
                'hover:-translate-y-1.5 hover:bg-surface-3 cursor-pointer active:scale-[0.96] active:translate-y-0',
              disabled && 'opacity-30 cursor-not-allowed',
              isPicking && `animate-card-pick ${selectedDestaque}`,
              isSelected && !isPicking && `!-translate-y-4 !scale-[1.06] ${selectedDestaque}`,
              !isSelected && !isPicking && 'border-border hover:border-border-strong',
            )}
          >
            <span
              className={cn(
                'text-2xl font-mono font-medium transition-colors',
                isSelected || isPicking ? 'text-text' : 'text-muted group-hover:text-text',
                isSymbol && 'font-sans text-xl',
              )}
            >
              {value}
            </span>
            {(isSelected || isPicking) && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-text" />
            )}
          </button>
        );
      })}
    </div>
  );
}
