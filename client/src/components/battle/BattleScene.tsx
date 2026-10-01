import { useEffect, useRef } from 'react';
import type { Battle, Side } from '../../services/battle';
import { cn } from '../../utils/cn';
import { FighterSprite, HpBox, type SpriteFx } from './FighterPanel';
import { TYPE_COLOR } from './labels';

/** Efeito na cena inteira: clarão no super efetivo, tremor no crítico. */
export interface SceneFx {
  kind: 'flash' | 'shake';
  n: number;
}

interface BattleSceneProps {
  battle: Battle;
  fx: Record<Side, SpriteFx | null>;
  sceneFx: SceneFx | null;
  reduced: boolean;
  /** Escurece a cena: a derrota. */
  dimmed: boolean;
}

const SHAKE: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-5px, 2px)' },
  { transform: 'translate(5px, -2px)' },
  { transform: 'translate(-3px, -1px)' },
  { transform: 'translate(3px, 1px)' },
  { transform: 'translate(0, 0)' },
];

/** A plataforma elíptica sob cada Pokémon, tingida pela cor do cenário. */
function Platform({ tint, className }: { tint: string; className: string }) {
  return (
    <div
      aria-hidden
      className={cn('absolute rounded-[50%] -translate-x-1/2 translate-y-1/2', className)}
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${tint}66 0%, ${tint}33 55%, ${tint}14 75%)`,
        boxShadow: `inset 0 -4px 0 rgb(0 0 0 / 0.28), inset 0 3px 0 ${tint}55`,
      }}
    />
  );
}

/**
 * O campo de batalha no enquadramento do jogo: selvagem no alto à direita, o
 * seu de costas embaixo à esquerda, cada HUD no canto oposto ao do sprite.
 */
export function BattleScene({ battle, fx, sceneFx, reduced, dimmed }: BattleSceneProps) {
  const shakeRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const tint = TYPE_COLOR[battle.wild.types[0]];

  useEffect(() => {
    if (!sceneFx) return;
    if (sceneFx.kind === 'shake' && !reduced) {
      shakeRef.current?.animate(SHAKE, { duration: 300, easing: 'linear' });
    }
    flashRef.current?.animate([{ opacity: sceneFx.kind === 'flash' ? 0.75 : 0.4 }, { opacity: 0 }], {
      duration: reduced ? 120 : 260,
      easing: 'ease-out',
    });
  }, [sceneFx?.n]);

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-black/60 shadow-[inset_0_0_0_2px_rgb(255_255_255/0.06)]">
      <div
        ref={shakeRef}
        className="relative aspect-[16/11] sm:aspect-[16/10]"
        style={{
          background: `linear-gradient(to bottom, ${tint}38 0%, ${tint}1A 46%, ${tint}2E 46%, ${tint}12 100%), rgb(var(--surface))`,
        }}
      >
        {/* Linhas do chão: dão profundidade sem precisar de arte. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[46%] opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 13px, ${tint}26 13px 15px)`,
          }}
        />

        <Platform tint={tint} className="left-[72%] top-[47%] w-[38%] h-[13%]" />
        <Platform tint={tint} className="left-[27%] top-[95%] w-[48%] h-[16%]" />

        {/* O wrapper centraliza; a animação de entrada usa o transform do filho. */}
        <div className="absolute left-[72%] bottom-[53%] -translate-x-1/2 w-[30%] sm:w-[26%] aspect-square">
          <FighterSprite
            fighter={battle.wild}
            side="wild"
            fx={fx.wild}
            fainted={battle.wild.hp === 0}
            reduced={reduced}
            intro
            className="w-full h-full"
          />
        </div>
        {/* O wrapper centraliza; a animação de entrada usa o transform do filho. */}
        <div className="absolute left-[27%] bottom-[-2%] -translate-x-1/2 w-[38%] sm:w-[34%] aspect-square">
          <FighterSprite
            fighter={battle.player}
            side="player"
            fx={fx.player}
            fainted={battle.player.hp === 0}
            reduced={reduced}
            intro
            className="w-full h-full"
          />
        </div>

        <HpBox
          fighter={battle.wild}
          side="wild"
          className={cn(
            'absolute left-[3%] top-[5%] w-[54%] sm:w-[46%]',
            !reduced && 'animate-enter-from-left [animation-delay:650ms]',
          )}
        />
        <HpBox
          fighter={battle.player}
          side="player"
          className={cn(
            'absolute right-[3%] bottom-[5%] w-[56%] sm:w-[48%]',
            !reduced && 'animate-enter-from-right [animation-delay:650ms]',
          )}
        />

        <span className="absolute right-[3%] top-[5%] font-pixel text-xs leading-none px-1.5 py-1 rounded-sm bg-black/45 text-white/85 tabular-nums">
          T{battle.turn}/{battle.maxTurns}
        </span>
      </div>

      <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 bg-white opacity-0" />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-black transition-opacity duration-700',
          dimmed ? 'opacity-60' : 'opacity-0',
        )}
      />

      {/* Cortina de abertura: a tela "abre" de cima e de baixo, como no começo de toda batalha. */}
      {!reduced && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-black origin-top animate-curtain-up" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-black origin-bottom animate-curtain-up" />
        </>
      )}
    </div>
  );
}
