import { cn } from '../../utils/cn';
import type { DailyGuess } from '../../services/guess';
import { Silhouette } from './Silhouette';

interface GuessTabProps {
  guess: DailyGuess;
  onOpen: () => void;
}

const LABEL: Record<DailyGuess['status'], string> = {
  open: 'Quem é?',
  correct: 'Acertou!',
  wrong: 'Volte amanhã',
};

/** A orelha do "Quem é esse Pokémon?". Pulsa até a pessoa dar o palpite. */
export function GuessTab({ guess, onOpen }: GuessTabProps) {
  const open = guess.status === 'open';
  return (
    <button
      type="button"
      onClick={onOpen}
      title={open ? 'Quem é esse Pokémon?' : LABEL[guess.status]}
      className={cn(
        'flex flex-col items-center gap-2 py-3 pl-2 pr-1.5',
        'rounded-l-xl border border-r-0 bg-surface transition-all hover:pr-3 animate-fade-in',
        open ? 'border-highlight/50 motion-safe:animate-pulse-glow' : 'border-border',
      )}
    >
      {guess.answer ? (
        <img
          src={guess.answer.sprite}
          alt=""
          className="w-10 h-10 object-contain opacity-60 grayscale"
        />
      ) : (
        <Silhouette day={guess.day} className="w-10 h-10" />
      )}
      <span
        className={cn(
          'text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180',
          open ? 'text-highlight' : 'text-muted',
        )}
      >
        {LABEL[guess.status]}
      </span>
    </button>
  );
}
