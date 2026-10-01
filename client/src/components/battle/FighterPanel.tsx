import { useEffect, useRef, useState } from 'react';
import { SPRITE_BASE } from '../../data/pokedex';
import type { FighterView, Side, StatKey } from '../../services/battle';
import { cn } from '../../utils/cn';
import { AILMENT_CHIP, STAT_SHORT, TYPE_COLOR, TYPE_LABEL } from './labels';

/** Último efeito visual de um lado. `n` muda a cada evento e dispara a animação. */
export interface SpriteFx {
  kind: 'lunge' | 'hit';
  n: number;
}

/** Verde, amarelo e vermelho do jogo: mais vivos que os tokens do app. */
function hpColor(ratio: number): { base: string; light: string } {
  if (ratio > 0.5) return { base: '#3FB45A', light: '#7CE08E' };
  if (ratio > 0.2) return { base: '#E3A51C', light: '#F8D25A' };
  return { base: '#D9452E', light: '#F58870' };
}

interface HpBoxProps {
  fighter: FighterView;
  side: Side;
  className?: string;
}

/** O HUD do jogo: nome, nível, status e barra de HP. Só o seu mostra os números. */
export function HpBox({ fighter, side, className }: HpBoxProps) {
  const ratio = fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 0;
  const stages = Object.entries(fighter.stages) as [StatKey, number][];
  const color = hpColor(ratio);

  return (
    <div className={cn('gba-hud px-3 pt-1.5 pb-2', className)}>
      <div className="flex items-baseline justify-between gap-2 font-pixel">
        <p className="text-[15px] sm:text-base font-semibold leading-tight truncate">{fighter.name}</p>
        <div className="flex items-baseline gap-1.5 shrink-0">
          {fighter.ailment && (
            <span
              className="self-center px-1 rounded-sm text-[10px] leading-[14px] font-semibold text-white"
              style={{ backgroundColor: AILMENT_CHIP[fighter.ailment].color }}
            >
              {AILMENT_CHIP[fighter.ailment].label}
            </span>
          )}
          {fighter.confused && (
            <span className="self-center px-1 rounded-sm text-[10px] leading-[14px] font-semibold text-white bg-[#8A6BBE]">
              CONF
            </span>
          )}
          <span className="text-sm">
            <span className="text-[10px]">Nv</span>
            {fighter.level}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <span className="font-pixel text-[10px] font-semibold leading-none px-1 py-0.5 rounded-sm bg-[#E8A33A] text-[#3A2406]">
          HP
        </span>
        <div
          className="gba-hp-track flex-1"
          role="meter"
          aria-label={`HP de ${fighter.name}`}
          aria-valuemin={0}
          aria-valuemax={fighter.maxHp}
          aria-valuenow={fighter.hp}
        >
          <div className="h-2 rounded-[2px] bg-[#2A2F36] overflow-hidden">
            <div
              className="h-full transition-[width] duration-500 ease-linear motion-reduce:transition-none"
              style={{
                width: `${ratio * 100}%`,
                background: `linear-gradient(to bottom, ${color.light} 0 35%, ${color.base} 35% 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 min-h-[14px]">
        <div className="flex flex-wrap items-center gap-x-1.5 font-pixel text-[10px] leading-none">
          {fighter.types.map((t) => (
            <span key={t} style={{ color: TYPE_COLOR[t] }} className="font-semibold uppercase brightness-75">
              {TYPE_LABEL[t]}
            </span>
          ))}
          {stages.map(([stat, n]) => (
            <span key={stat} className={n > 0 ? 'text-[#2F8A47]' : 'text-[#B5372A]'}>
              {n > 0 ? '▲' : '▼'}
              {STAT_SHORT[stat]}
              {Math.abs(n) > 1 && `×${Math.abs(n)}`}
            </span>
          ))}
        </div>
        {side === 'player' && (
          <span className="font-pixel text-sm leading-none tabular-nums shrink-0">
            {fighter.hp}
            <span className="opacity-60">/</span>
            {fighter.maxHp}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Seu Pokémon aparece de costas, como no jogo. Nem toda forma nova tem sprite
 * de costas no repositório: sem ele, cai no de frente espelhado.
 */
function SpriteImg({ fighter, side }: { fighter: FighterView; side: Side }) {
  const [fallback, setFallback] = useState(false);
  const back = side === 'player' && !fallback;
  return (
    <img
      src={back ? `${SPRITE_BASE}back/${fighter.dexId}.png` : fighter.sprite}
      alt={fighter.name}
      onError={() => setFallback(true)}
      className={cn(
        'w-full h-full object-contain object-bottom [image-rendering:pixelated]',
        side === 'player' && fallback && '-scale-x-100',
      )}
      draggable={false}
    />
  );
}

/** O avanço vai na direção do adversário: o seu sobe para a direita, o selvagem desce para a esquerda. */
const LUNGE: Record<Side, Keyframe[]> = {
  player: [
    { transform: 'translate(0, 0)' },
    { transform: 'translate(18px, -10px)', offset: 0.35 },
    { transform: 'translate(0, 0)' },
  ],
  wild: [
    { transform: 'translate(0, 0)' },
    { transform: 'translate(-18px, 6px)', offset: 0.35 },
    { transform: 'translate(0, 0)' },
  ],
};

/** Pisca três vezes, como o Pokémon atingido no jogo. Só opacidade: vale com movimento reduzido. */
const HIT: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0, offset: 0.15 },
  { opacity: 1, offset: 0.3 },
  { opacity: 0, offset: 0.45 },
  { opacity: 1, offset: 0.6 },
  { opacity: 0, offset: 0.75 },
  { opacity: 1 },
];

interface FighterSpriteProps {
  fighter: FighterView;
  side: Side;
  fx: SpriteFx | null;
  fainted: boolean;
  reduced: boolean;
  /** Entra deslizando ao montar (começo da luta). */
  intro: boolean;
  className?: string;
}

export function FighterSprite({ fighter, side, fx, fainted, reduced, intro, className }: FighterSpriteProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !fx) return;
    if (fx.kind === 'lunge') {
      if (!reduced) el.animate(LUNGE[side], { duration: 320, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' });
    } else {
      el.animate(HIT, { duration: reduced ? 240 : 480, easing: 'steps(1, end)' });
    }
    // Só o contador dispara: o resto não muda durante o efeito.
  }, [fx?.n]);

  return (
    // Três camadas para as animações não brigarem pelo `transform`: entrada, desmaio e golpe.
    <div
      className={cn(
        intro && !reduced && (side === 'wild' ? 'animate-enter-from-left' : 'animate-enter-from-right'),
        className,
      )}
    >
      <div
        className="w-full h-full transition-[transform,clip-path,opacity] duration-500 ease-in"
        // Desmaiar = afundar na plataforma. O recorte acompanha a descida e esconde o que passa da base.
        style={
          reduced
            ? { opacity: fainted ? 0 : 1 }
            : {
                transform: fainted ? 'translateY(100%)' : undefined,
                clipPath: fainted ? 'inset(-60% -60% 100% -60%)' : 'inset(-60% -60% -20% -60%)',
              }
        }
      >
        <div ref={ref} className="w-full h-full">
          <SpriteImg fighter={fighter} side={side} />
        </div>
      </div>
    </div>
  );
}
