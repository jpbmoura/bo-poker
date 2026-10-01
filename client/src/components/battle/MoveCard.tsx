import type { MoveView } from '../../services/battle';
import { cn } from '../../utils/cn';
import { TYPE_COLOR, TYPE_LABEL, describeEffect, effectivenessLabel } from './labels';

interface MoveCardProps {
  move: MoveView;
  disabled: boolean;
  onPlay: () => void;
}

const CATEGORY_LABEL = { physical: 'Físico', special: 'Especial', status: 'Status' } as const;

/**
 * Uma carta da mão. A cor é a do tipo do golpe; a efetividade contra o
 * adversário aparece na própria carta, que é onde a decisão acontece.
 */
export function MoveCard({ move, disabled, onPlay }: MoveCardProps) {
  const color = TYPE_COLOR[move.type];
  const eff = effectivenessLabel(move);
  const effects = describeEffect(move.effect);

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col text-left rounded-xl border bg-surface-2 p-3 min-h-[148px]',
        'transition-[transform,box-shadow,opacity] duration-base ease-out-expo outline-none',
        'focus-visible:ring-2 focus-visible:ring-highlight/70',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0',
      )}
      style={{ borderColor: `${color}66`, boxShadow: `inset 0 3px 0 ${color}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color, backgroundColor: `${color}1F` }}
        >
          {TYPE_LABEL[move.type]}
        </span>
        <span className="text-[10px] text-subtle">{CATEGORY_LABEL[move.category]}</span>
      </div>

      <p className="mt-2 text-sm font-semibold text-text leading-tight">{move.name}</p>

      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono text-muted">
        {move.power > 0 && (
          <span title="Poder">
            {move.power}
            {move.stab && <span className="text-highlight" title="Mesmo tipo do Pokémon: ×1.5"> ★</span>}
          </span>
        )}
        <span title="Precisão">{move.accuracy === 0 ? '—' : `${move.accuracy}%`}</span>
        {move.priority > 0 && <span className="text-highlight">+{move.priority} prio</span>}
      </div>

      {effects.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {effects.map((text) => (
            <li key={text} className="text-[11px] text-muted leading-snug">
              {text}
            </li>
          ))}
        </ul>
      )}

      {eff && (
        <span
          className={cn(
            'mt-auto pt-2 text-[10px] font-semibold',
            eff.tone === 'good' && 'text-success',
            eff.tone === 'bad' && 'text-danger',
            eff.tone === 'none' && 'text-subtle',
          )}
        >
          {eff.text}
        </span>
      )}
    </button>
  );
}
