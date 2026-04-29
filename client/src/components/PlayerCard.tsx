import { cn } from '../utils/cn';
import type { SerializedPlayer } from '../types';
import { PokeballIcon } from './ui/PokeballIcon';

interface PlayerCardProps {
  player: SerializedPlayer;
  revealed: boolean;
  isSelf: boolean;
  flipDelayMs: number;
  shaking: boolean;
}

export function PlayerCard({ player, revealed, isSelf, flipDelayMs, shaking }: PlayerCardProps) {
  const hasVoted = player.vote !== null;
  const isSpectator = player.role === 'spectator';
  const offline = !player.online;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 transition-opacity',
        offline && 'opacity-50',
      )}
    >
      {/* Card slot */}
      <div className="h-20 w-14 flex items-end">
        {isSpectator ? null : (
          <div className="flip-scene w-full h-full">
            <div
              className={cn('flip-card', revealed && hasVoted && 'is-revealed')}
              style={{
                transitionDelay: revealed && hasVoted ? `${flipDelayMs}ms` : '0ms',
              }}
            >
              {/* Front (back of card visually until revealed) */}
              <div className="flip-face front">
                {hasVoted ? (
                  <div className="w-full h-full rounded-lg border border-accent/40 bg-gradient-to-b from-accent/20 to-accent/5 flex items-center justify-center">
                    <PokeballIcon size={24} className="text-accent/70" />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-lg border border-dashed border-border-strong bg-surface flex items-center justify-center">
                    <span className="text-subtle text-lg">…</span>
                  </div>
                )}
              </div>
              {/* Back (revealed value) */}
              <div className="flip-face back">
                <div className="relative w-full h-full rounded-lg border border-border-strong bg-surface-elevated flex items-center justify-center">
                  <span className="text-2xl font-bold text-text">
                    {player.vote ?? '—'}
                  </span>
                  {player.pokemon.sprite && (
                    <img
                      src={player.pokemon.sprite}
                      alt=""
                      className="absolute bottom-0.5 right-0.5 w-5 h-5 object-contain opacity-60"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div
        className={cn(
          'relative w-16 h-16 rounded-full bg-surface-elevated border-2 flex items-center justify-center p-1',
          hasVoted && !isSpectator ? 'border-accent/60' : 'border-border-strong',
          shaking && 'animate-shake',
        )}
      >
        {player.pokemon.sprite ? (
          <img
            src={player.pokemon.sprite}
            alt={player.pokemon.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <PokeballIcon className="text-muted" />
        )}
        {isSelf && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-highlight ring-2 ring-bg" />
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 min-h-[34px]">
        <span className="text-sm font-medium text-text max-w-[96px] truncate">
          {player.name}
        </span>
        {isSpectator && (
          <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface-elevated border border-border">
            👁 Espectador
          </span>
        )}
        {offline && !isSpectator && (
          <span className="text-[10px] text-subtle">offline</span>
        )}
      </div>
    </div>
  );
}
