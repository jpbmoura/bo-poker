import { useState } from 'react';
import { SPRITE_BASE } from '../../data/pokedex';
import type { FighterView, StatKey } from '../../services/battle';
import { cn } from '../../utils/cn';
import { AILMENT_CHIP, STAT_SHORT, TYPE_COLOR, TYPE_LABEL } from './labels';

interface FighterPanelProps {
  fighter: FighterView;
  side: 'player' | 'wild';
  /** Muda a cada golpe recebido: reinicia a animação de tremor. */
  hitKey: number;
  fainted: boolean;
  reduced: boolean;
}

function hpColor(ratio: number): string {
  if (ratio > 0.5) return 'bg-success';
  if (ratio > 0.2) return 'bg-highlight';
  return 'bg-danger';
}

/**
 * Seu Pokémon aparece de costas, como no jogo. Nem toda forma nova tem sprite
 * de costas no repositório: sem ele, cai no de frente espelhado.
 */
function Sprite({ fighter, side }: { fighter: FighterView; side: 'player' | 'wild' }) {
  const [fallback, setFallback] = useState(false);
  const back = side === 'player' && !fallback;
  return (
    <img
      src={back ? `${SPRITE_BASE}back/${fighter.dexId}.png` : fighter.sprite}
      alt={fighter.name}
      onError={() => setFallback(true)}
      className={cn(
        'w-24 h-24 sm:w-28 sm:h-28 object-contain [image-rendering:pixelated]',
        side === 'player' && fallback && '-scale-x-100',
      )}
      draggable={false}
    />
  );
}

export function FighterPanel({ fighter, side, hitKey, fainted, reduced }: FighterPanelProps) {
  const ratio = fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 0;
  const stages = Object.entries(fighter.stages) as [StatKey, number][];

  return (
    <div className={cn('flex items-end gap-3', side === 'wild' && 'flex-row-reverse')}>
      <div
        key={hitKey}
        className={cn(
          'shrink-0 transition-[opacity,transform] duration-slow',
          hitKey > 0 && !reduced && 'animate-shake',
          fainted && 'opacity-0 translate-y-4',
        )}
      >
        <Sprite fighter={fighter} side={side} />
      </div>

      <div className="flex-1 min-w-0 rounded-xl border border-border bg-surface-2/80 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-text truncate">{fighter.name}</p>
          <span className="text-[11px] font-mono text-subtle shrink-0">Nv. {fighter.level}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {fighter.types.map((t) => (
            <span
              key={t}
              className="text-[9px] font-semibold uppercase tracking-wider px-1 rounded"
              style={{ color: TYPE_COLOR[t], backgroundColor: `${TYPE_COLOR[t]}1F` }}
            >
              {TYPE_LABEL[t]}
            </span>
          ))}
          {fighter.ailment && (
            <span
              className="text-[9px] font-bold px-1 rounded text-bg"
              style={{ backgroundColor: AILMENT_CHIP[fighter.ailment].color }}
            >
              {AILMENT_CHIP[fighter.ailment].label}
            </span>
          )}
          {fighter.confused && (
            <span className="text-[9px] font-bold px-1 rounded bg-surface-4 text-text">CONF</span>
          )}
          {stages.map(([stat, n]) => (
            <span
              key={stat}
              className={cn(
                'text-[9px] font-mono font-semibold px-1 rounded',
                n > 0 ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft',
              )}
            >
              {STAT_SHORT[stat]} {n > 0 ? '+' : ''}
              {n}
            </span>
          ))}
        </div>

        <div
          className="mt-1.5 h-2 w-full rounded-full bg-surface-4 overflow-hidden"
          role="meter"
          aria-label={`HP de ${fighter.name}`}
          aria-valuemin={0}
          aria-valuemax={fighter.maxHp}
          aria-valuenow={fighter.hp}
        >
          <div
            className={cn('h-full rounded-full transition-[width,background-color] duration-slow ease-out-expo', hpColor(ratio))}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="mt-0.5 text-right text-[10px] font-mono text-subtle">
          {fighter.hp}/{fighter.maxHp}
        </p>
      </div>
    </div>
  );
}
