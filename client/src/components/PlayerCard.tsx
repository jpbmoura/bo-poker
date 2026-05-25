import { motion } from 'framer-motion';
import { cn } from '../utils/cn';
import type { SerializedPlayer } from '../types';
import { PokeballIcon } from './ui/PokeballIcon';
import { CountUpValue } from './CountUpValue';

interface PlayerCardProps {
  player: SerializedPlayer;
  revealed: boolean;
  isSelf: boolean;
  flipDelayMs: number;
  enterDelayMs: number;
  shaking: boolean;
  glowing: boolean;
  risen: boolean;
  charging: boolean;
  flipReady: boolean;
  isOutlier: boolean;
  isWaiting: boolean;
  celebrating: boolean;
}

const FLIP_DURATION_S = 0.7;

export function PlayerCard({
  player,
  revealed,
  isSelf,
  flipDelayMs,
  enterDelayMs,
  shaking,
  glowing,
  risen,
  charging,
  flipReady,
  isOutlier,
  isWaiting,
  celebrating,
}: PlayerCardProps) {
  const hasVoted = player.vote !== null;
  const offline = !player.online;
  const showRevealed = revealed && flipReady && hasVoted;
  const delaySec = flipDelayMs / 1000;
  const voteString = typeof player.vote === 'string' ? player.vote : null;

  return (
    <motion.div
      layout="position"
      className={cn(
        'flex flex-col items-center gap-3',
        offline && 'opacity-40',
      )}
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        layout: { type: 'spring', stiffness: 160, damping: 22 },
        opacity: { duration: 0.4, delay: enterDelayMs / 1000 },
        y: { duration: 0.5, delay: enterDelayMs / 1000, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: 0.5, delay: enterDelayMs / 1000, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      {/* Card outer (handles shake + charging scale + celebration bounce) */}
      <motion.div
        className="relative h-40 w-28"
        animate={{
          scale: charging ? 0.96 : celebrating ? [1, 1.06, 1] : 1,
          x: shaking ? [0, -4, 4, -3, 3, 0] : 0,
        }}
        transition={{
          scale: celebrating
            ? { duration: 0.6, times: [0, 0.5, 1], ease: 'easeOut' }
            : { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
          x: { duration: 0.5, ease: 'easeInOut' },
        }}
      >
        {/* Charging halo */}
        {charging && (
          <motion.div
            aria-hidden
            className="absolute -inset-2 rounded-2xl bg-highlight/15 blur-xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.7, 0.4], scale: [0.9, 1.05, 1] }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        )}

        {/* Pokémon emerging from behind the card after reveal */}
        {hasVoted && player.pokemon.sprite && (
          <motion.img
            src={player.pokemon.sprite}
            alt=""
            aria-hidden="true"
            className="absolute left-1/2 top-0 w-20 h-20 z-0 pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            style={{ x: '-50%' }}
            animate={{
              y: risen ? (celebrating ? -64 : -54) : 0,
              scale: celebrating ? [1, 1.12, 1] : 1,
            }}
            transition={{
              y: { type: 'spring', stiffness: 220, damping: 16 },
              scale: { duration: 0.5, times: [0, 0.5, 1], ease: 'easeOut' },
            }}
          />
        )}

        {/* 3D flip scene */}
        <div
          className="relative z-10 w-full h-full"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{
              rotateY: showRevealed ? 180 : 0,
              z: showRevealed ? [0, 60, 0] : 0,
            }}
            transition={{
              rotateY: {
                duration: FLIP_DURATION_S,
                delay: showRevealed ? delaySec : 0,
                ease: [0.34, 1.56, 0.64, 1],
              },
              z: {
                duration: FLIP_DURATION_S,
                delay: showRevealed ? delaySec : 0,
                times: [0, 0.5, 1],
                ease: 'easeInOut',
              },
            }}
          >
            {/* Front (face down) */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
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
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-success" />
                </div>
              ) : (
                <div
                  className={cn(
                    'w-full h-full rounded-xl border-2 border-dashed bg-transparent flex items-center justify-center p-3 transition-colors duration-300',
                    isWaiting ? 'border-border-strong/70' : 'border-border opacity-60',
                  )}
                >
                  {isWaiting ? (
                    <span className="flex items-center gap-1 text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:180ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:360ms]" />
                    </span>
                  ) : player.pokemon.sprite ? (
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

            {/* Back (revealed) */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div
                className={cn(
                  'relative w-full h-full rounded-xl border bg-surface-2 flex items-center justify-center shadow-sm overflow-hidden',
                  isSelf ? 'border-border-strong' : 'border-border',
                  glowing && 'animate-glow-once',
                  isOutlier && 'animate-outlier-ring border-highlight/70',
                )}
              >
                <motion.span
                  className={cn(
                    'text-5xl font-mono font-bold',
                    isOutlier ? 'text-highlight' : 'text-text',
                  )}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={
                    showRevealed
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0.6, opacity: 0 }
                  }
                  transition={{
                    duration: 0.32,
                    delay: showRevealed ? delaySec + FLIP_DURATION_S * 0.55 : 0,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                >
                  <CountUpValue
                    value={voteString}
                    active={showRevealed}
                    delayMs={flipDelayMs + FLIP_DURATION_S * 1000 * 0.55}
                    durationMs={380}
                  />
                </motion.span>
                {isOutlier && (
                  <span className="absolute -top-2 -right-1 text-[9px] uppercase tracking-wider font-mono font-semibold text-highlight bg-bg/80 px-1.5 py-0.5 rounded">
                    Outlier
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

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
        {offline && <span className="text-[10px] text-subtle">offline</span>}
      </div>
    </motion.div>
  );
}
