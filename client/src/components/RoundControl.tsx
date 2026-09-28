import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { eligibleVoters } from '../utils/stats';
import type { SerializedPlayer } from '../types';

interface RoundControlProps {
  players: SerializedPlayer[];
  revealed: boolean;
  canReveal: boolean;
  onReveal: () => void;
  onReset: () => void;
}

/** Acima disso os dots viram ruído; o texto "x de y" já basta. */
const MAX_DOTS = 12;

export function RoundControl({ players, revealed, canReveal, onReveal, onReset }: RoundControlProps) {
  const voters = useMemo(() => eligibleVoters(players), [players]);
  const votedCount = voters.filter((p) => p.vote !== null).length;
  const pending = voters.filter((p) => p.vote === null && p.online);
  const allVoted = voters.length > 0 && votedCount === voters.length;

  if (revealed) {
    return (
      <Button variant="solid" size="lg" onClick={onReset} className="min-w-[168px] press-down">
        <RotateCcw size={15} />
        Nova rodada
      </Button>
    );
  }

  const pendingNames = pending.map((p) => p.name).join(', ');

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={allVoted ? 'solid' : 'primary'}
        size="lg"
        onClick={onReveal}
        disabled={!canReveal}
        // Um pulso só, quando o último voto chega. Loop infinito cansava e
        // perdia o sentido de "agora é a hora".
        className={cn('min-w-[168px] press-down', allVoted && 'motion-safe:animate-glow-once')}
      >
        Revelar cartas
      </Button>

      {voters.length > 0 && (
        <div
          className="hidden sm:flex flex-col gap-1.5"
          title={pending.length > 0 ? `Falta votar: ${pendingNames}` : 'Todo mundo votou'}
        >
          <span className="text-xs text-muted tabular-nums whitespace-nowrap">
            {votedCount === 0 ? (
              'Ninguém votou ainda'
            ) : allVoted ? (
              <span className="text-text">Todo mundo votou</span>
            ) : (
              <>
                <span className="text-text font-medium">{votedCount}</span> de {voters.length}{' '}
                votaram
              </>
            )}
          </span>
          {voters.length <= MAX_DOTS && (
            <div className="flex gap-1" aria-hidden>
              {voters.map((p) => (
                <span
                  key={p.id}
                  className={cn(
                    'h-1.5 w-3 rounded-full transition-colors duration-base',
                    p.vote !== null ? 'bg-success' : 'bg-surface-4',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* Leitores de tela: o progresso da votação sem depender dos dots. */}
      <span className="sr-only" aria-live="polite">
        {`${votedCount} de ${voters.length} votaram`}
      </span>
    </div>
  );
}
