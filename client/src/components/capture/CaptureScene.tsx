import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { CaptureBall } from './CaptureBall';

/**
 * Fases do lançamento, na ordem:
 * idle -> throw (bola em arco) -> absorb (clarão, o Pokémon entra na bola)
 * -> wait (bola parada até a resposta do servidor) -> shake (N balançadas)
 * -> caught (clique + estrelas) | escape (a bola abre e ele volta).
 */
export type ScenePhase = 'idle' | 'throw' | 'absorb' | 'wait' | 'shake' | 'caught' | 'escape';

/** Duração de cada fase, em ms. Quem cronometra é o drawer; a cena só desenha. */
export const SCENE_MS = {
  throw: 550,
  absorb: 450,
  wobble: 750,
  settle: 350,
  caught: 1400,
  escape: 700,
} as const;

/** Sem movimento: tudo vira cortes curtos, só para o resultado não se perder. */
export const REDUCED_MS = {
  throw: 0,
  absorb: 150,
  wobble: 250,
  settle: 0,
  caught: 900,
  escape: 400,
} as const;

interface CaptureSceneProps {
  sprite: string;
  name: string;
  phase: ScenePhase;
  /** Quantas balançadas a bola dá na fase `shake`. */
  wobbles: number;
  glow: string;
  reduced: boolean;
  /** O Pokémon já é do usuário (capturado hoje): mostra só a bola fechada. */
  captured: boolean;
}

const STARS = [
  { x: -46, y: -34, delay: 0 },
  { x: 48, y: -28, delay: 0.08 },
  { x: -30, y: 40, delay: 0.16 },
  { x: 40, y: 38, delay: 0.1 },
];

export function CaptureScene({
  sprite,
  name,
  phase,
  wobbles,
  glow,
  reduced,
  captured,
}: CaptureSceneProps) {
  const inBall = phase === 'absorb' || phase === 'wait' || phase === 'shake' || phase === 'caught';
  const showSprite = !captured && !inBall;
  // Na fuga a bola some na hora e quem aparece é o "estouro" abaixo: o exit de
  // um motion usa as props do ÚLTIMO render dele, não as da fase nova.
  const showBall = captured || (phase !== 'idle' && phase !== 'escape');
  const ms = reduced ? REDUCED_MS : SCENE_MS;

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-xl border border-border bg-surface-2">
      {/* Chão: um gradiente radial com a cor do tier, para o raro "brilhar". */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 72%, ${glow} 0%, transparent 60%)`,
        }}
      />
      <div className="absolute left-1/2 top-[70%] h-4 w-28 -translate-x-1/2 rounded-[50%] bg-black/30 blur-[2px]" />

      <div className="absolute inset-0 flex items-center justify-center">
        {/* O Pokémon selvagem. */}
        <AnimatePresence>
          {showSprite && (
            <motion.img
              key="sprite"
              src={sprite}
              alt={name}
              className="absolute w-32 h-32 object-contain [image-rendering:pixelated]"
              initial={phase === 'escape' ? { scale: 0, opacity: 0 } : { scale: 0.9, opacity: 0 }}
              animate={
                reduced
                  ? { scale: 1, opacity: 1 }
                  : { scale: 1, opacity: 1, y: [0, -6, 0] }
              }
              exit={{
                scale: 0,
                opacity: 0,
                filter: 'brightness(0) invert(1)',
                transition: { duration: ms.absorb / 1000 },
              }}
              transition={{
                scale: { type: 'spring', stiffness: 320, damping: 16 },
                opacity: { duration: 0.2 },
                y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
              }}
            />
          )}
        </AnimatePresence>

        {/* Clarão de quando ele é puxado para dentro da bola. */}
        <AnimatePresence>
          {phase === 'absorb' && !reduced && (
            <motion.div
              key="flash"
              className="absolute w-24 h-24 rounded-full bg-white"
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ms.absorb / 1000, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* A bola. */}
        <AnimatePresence>
          {showBall && (
            <motion.div
              key={`ball-${phase === 'shake' ? 'shake' : 'still'}`}
              className="absolute top-[58%] origin-bottom"
              initial={
                phase === 'throw' && !reduced
                  ? { x: 150, y: 120, rotate: 0, scale: 0.5, opacity: 1 }
                  : false
              }
              animate={
                phase === 'throw' && !reduced
                  ? {
                      x: [150, 60, 0],
                      y: [120, -90, 0],
                      rotate: [0, 360, 720],
                      scale: [0.5, 0.8, 1],
                    }
                  : phase === 'shake'
                    ? { rotate: [0, -22, 16, -8, 0] }
                    : phase === 'caught' && !reduced
                      ? { scale: [1, 1.12, 1], rotate: 0 }
                      : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
              }
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={
                phase === 'throw'
                  ? { duration: ms.throw / 1000, ease: 'easeOut', times: [0, 0.5, 1] }
                  : phase === 'shake'
                    ? {
                        duration: (ms.wobble * 0.6) / 1000,
                        repeat: Math.max(wobbles - 1, 0),
                        repeatDelay: (ms.wobble * 0.4) / 1000,
                        ease: 'easeInOut',
                      }
                    : { duration: 0.3 }
              }
            >
              <CaptureBall size={56} lit={phase === 'caught' || captured} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* A bola abrindo quando ele escapa. */}
        <AnimatePresence>
          {phase === 'escape' && (
            <motion.div
              key="burst"
              className="absolute top-[58%]"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <CaptureBall size={56} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estrelinhas do "capturado!". */}
        <AnimatePresence>
          {phase === 'caught' &&
            !reduced &&
            STARS.map((s, i) => (
              <motion.span
                key={`star-${i}`}
                className="absolute top-[58%] text-highlight"
                initial={{ x: 0, y: 20, scale: 0, opacity: 0 }}
                animate={{ x: s.x, y: s.y, scale: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, delay: s.delay, ease: 'easeOut' }}
              >
                <Sparkles size={16} />
              </motion.span>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
