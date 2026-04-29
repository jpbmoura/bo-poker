import { cn } from '../utils/cn';
import type { CardValue } from '../types';

interface CardDeckProps {
  sequence: CardValue[];
  selected: CardValue | null;
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function CardDeck({ sequence, selected, disabled, onSelect }: CardDeckProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 py-4">
      {sequence.map((value) => {
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(value)}
            className={cn(
              'w-16 h-24 rounded-lg border bg-surface-elevated text-text font-bold text-2xl flex items-center justify-center transition-all duration-150',
              !disabled && 'hover:-translate-y-1 hover:border-border-strong cursor-pointer',
              disabled && 'opacity-40 cursor-not-allowed',
              isSelected
                ? '!-translate-y-3 border-accent shadow-[0_0_0_3px_var(--accent-soft)]'
                : 'border-border',
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
