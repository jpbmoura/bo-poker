import { CircleDot, Sparkles, Swords } from 'lucide-react';
import type { MoveView } from '../../services/battle';
import { cn } from '../../utils/cn';
import { TYPE_COLOR, TYPE_LABEL, describeEffect, effectivenessLabel, fmtMult } from './labels';

interface MoveCardProps {
  move: MoveView;
  disabled: boolean;
  onPlay: () => void;
}

const CATEGORY = {
  physical: { label: 'Físico', Icon: Swords, color: '#E8743B' },
  special: { label: 'Especial', Icon: Sparkles, color: '#5B8DEF' },
  status: { label: 'Status', Icon: CircleDot, color: '#A1A1AA' },
} as const;

/** Selo curto: o texto completo vai no `title`. */
const SEAL = {
  good: (x: number) => `SUPER ×${fmtMult(x)}`,
  bad: (x: number) => `FRACO ×${fmtMult(x)}`,
  none: () => 'SEM EFEITO',
} as const;

/**
 * Uma carta da mão. A moldura é a cor do tipo do golpe; a efetividade contra o
 * adversário vira um selo e muda o tom da carta inteira, que é onde a decisão acontece.
 */
export function MoveCard({ move, disabled, onPlay }: MoveCardProps) {
  const color = TYPE_COLOR[move.type];
  const eff = effectivenessLabel(move);
  const effects = describeEffect(move.effect);
  const cat = CATEGORY[move.category];

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      title={eff?.text}
      className={cn(
        'relative w-full flex flex-col text-left rounded-lg border-[3px] bg-surface-2 p-2 sm:p-2.5 min-h-[164px] sm:min-h-[184px]',
        'transition-[transform,box-shadow,filter,opacity] duration-base ease-out-expo outline-none',
        'shadow-[0_4px_0_rgb(0_0_0/0.35)] focus-visible:ring-2 focus-visible:ring-highlight/70',
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:-translate-y-2 hover:shadow-[0_10px_0_rgb(0_0_0/0.3)] active:translate-y-0 active:shadow-[0_2px_0_rgb(0_0_0/0.35)]',
        eff?.tone === 'bad' && 'saturate-[.4]',
        eff?.tone === 'none' && 'grayscale',
      )}
      style={{
        borderColor: color,
        backgroundImage: `linear-gradient(160deg, ${color}38 0%, ${color}12 50%, transparent 80%)`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className="font-pixel text-[10px] font-semibold uppercase leading-none px-1.5 py-[3px] rounded-sm text-black/80"
          style={{ backgroundColor: color }}
        >
          {TYPE_LABEL[move.type]}
        </span>
        <span title={cat.label} aria-label={cat.label} role="img">
          <cat.Icon size={13} style={{ color: cat.color }} aria-hidden />
        </span>
      </div>

      <p className="mt-2 font-pixel text-[15px] sm:text-base font-semibold text-text leading-[1.1]">{move.name}</p>

      {move.power > 0 ? (
        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-pixel text-3xl leading-none text-text tabular-nums">{move.power}</span>
          {move.stab && (
            <span className="font-pixel text-sm text-highlight" title="Mesmo tipo do Pokémon: ×1.5">
              ★
            </span>
          )}
        </div>
      ) : null}

      <p className="mt-1 font-pixel text-[11px] text-muted leading-none">
        {move.accuracy === 0 ? 'Nunca erra' : `Precisão ${move.accuracy}%`}
        {move.priority > 0 && <span className="text-highlight"> · +{move.priority}</span>}
      </p>

      {effects.length > 0 && (
        <p className="mt-1.5 text-[11px] text-muted leading-snug line-clamp-3">{effects.join(' · ')}</p>
      )}

      {eff && (
        <span
          className={cn(
            'mt-auto self-start font-pixel text-[11px] font-semibold leading-none px-1.5 py-1 rounded-sm',
            eff.tone === 'good' && 'bg-success text-black/85',
            eff.tone === 'bad' && 'border border-danger/50 text-danger',
            eff.tone === 'none' && 'bg-surface-4 text-muted',
          )}
        >
          {SEAL[eff.tone](move.effectiveness)}
        </span>
      )}
    </button>
  );
}
