import { cn } from '../utils/cn';
import type { SerializedPlayer } from '../types';
import { PokeballIcon } from './ui/PokeballIcon';

interface PlayerCardProps {
  player: SerializedPlayer;
  revealed: boolean;
  isSelf: boolean;
  flipDelayMs: number;
  enterDelayMs: number;
  shaking: boolean;
  glowing: boolean;
  risen: boolean;
}

export function PlayerCard({
  player,
  revealed,
  isSelf,
  flipDelayMs,
  enterDelayMs,
  shaking,
  glowing,
  risen,
}: PlayerCardProps) {
  const hasVoted = player.vote !== null;
  const offline = !player.online;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 transition-opacity animate-card-in',
        offline && 'opacity-40',
      )}
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      {/* Card */}
      <div className={cn('relative h-40 w-28', shaking && 'animate-shake')}>
        {/* Pokémon emerging from behind the card after reveal */}
        {hasVoted && player.pokemon.sprite && (
          <img
            src={player.pokemon.sprite}
            alt=""
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 top-0 w-20 h-20 -translate-x-1/2 z-0 pointer-events-none',
              'transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              'drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]',
              risen ? '-translate-y-[54px]' : 'translate-y-0',
            )}
          />
        )}

        <div className="relative z-10 flip-scene w-full h-full">
          <div
            className={cn('flip-card', revealed && hasVoted && 'is-revealed')}
            style={{
              transitionDelay: revealed && hasVoted ? `${flipDelayMs}ms` : '0ms',
            }}
          >
            {/* Front (face down) — shows the Pokémon as identity */}
            <div className="flip-face front">
              {hasVoted ? (
                <div
                  className={cn(
                    'w-full h-full rounded-xl border bg-surface-2 flex items-center justify-center p-3 shadow-sm relative overflow-hidden',
                    isSelf ? 'border-border-strong' : 'border-border',
                    glowing && 'animate-glow-once',
                  )}
                >
                  {player.pokemon.sprite ? (
                    <img
                      src={player.pokemon.sprite}
                      alt={player.pokemon.name}
                      className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                    />
                  ) : (
                    <PokeballIcon size={48} className="text-muted" />
                  )}
                  {/* Subtle "voted" indicator dot */}
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-success" />
                </div>
              ) : (
                <div className="w-full h-full rounded-xl border border-dashed border-border bg-transparent flex items-center justify-center p-3 opacity-60">
                  {player.pokemon.sprite ? (
                    <img
                      src={player.pokemon.sprite}
                      alt={player.pokemon.name}
                      className="w-full h-full object-contain grayscale opacity-40"
                    />
                  ) : (
                    <PokeballIcon size={32} className="text-subtle" />
                  )}
                </div>
              )}
            </div>

            {/* Back (revealed) — shows the value */}
            <div className="flip-face back">
              <div
                className={cn(
                  'relative w-full h-full rounded-xl border bg-surface-2 flex items-center justify-center shadow-sm overflow-hidden',
                  isSelf ? 'border-border-strong' : 'border-border',
                  glowing && 'animate-glow-once',
                )}
              >
                <span className="text-5xl font-mono font-bold text-text">
                  {player.vote ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Name below card */}
      <div className="flex flex-col items-center gap-0.5 min-h-[28px] max-w-[120px]">
        <div className="flex items-center gap-1.5">
          {isSelf && <span className="w-1.5 h-1.5 rounded-full bg-highlight" />}
          <span
            className={cn(
              'text-sm truncate',
              isSelf ? 'text-text font-medium' : 'text-muted',
            )}
          >
            {player.name}
          </span>
        </div>
        {offline && (
          <span className="text-[10px] text-subtle">offline</span>
        )}
      </div>
    </div>
  );
}
