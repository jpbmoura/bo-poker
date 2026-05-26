import { memo, useEffect, useState } from 'react';
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
  charging: boolean;
  flipReady: boolean;
  isOutlier: boolean;
  isWaiting: boolean;
  celebrating: boolean;
}

const FLIP_DURATION_S = 0.7;
const EMERGE_DURATION_S = 0.7;
// Pokemon emerges when card hits 90° (edge-on, mid-flip)
const EMERGE_OFFSET_S = FLIP_DURATION_S * 0.5;

function PlayerCardInner({
  player,
  revealed,
  isSelf,
  flipDelayMs,
  enterDelayMs,
  shaking,
  glowing,
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
  const emergeDelaySec = delaySec + EMERGE_OFFSET_S;
  const voteString = typeof player.vote === 'string' ? player.vote : null;

  const [emerged, setEmerged] = useState(false);

  useEffect(() => {
    if (!showRevealed) {
      setEmerged(false);
      return;
    }
    const totalMs = (emergeDelaySec + EMERGE_DURATION_S) * 1000;
    const t = window.setTimeout(() => setEmerged(true), totalMs);
    return () => window.clearTimeout(t);
  }, [showRevealed, emergeDelaySec]);

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
      {/* Card outer (shake + charging compress) */}
      <motion.div
        className="relative h-40 w-28"
        animate={{
          scale: charging ? 0.96 : 1,
          x: shaking ? [0, -4, 4, -3, 3, 0] : 0,
        }}
        transition={{
          scale: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
          x: { duration: 0.5, ease: 'easeInOut' },
        }}
      >
        {/* Charging halo (pre-flip) */}
        {charging && (
          <motion.div
            aria-hidden
            className="absolute -inset-2 rounded-2xl bg-highlight/15 blur-xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.7, 0.4], scale: [0.9, 1.05, 1] }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        )}

        {/* Pokémon emerging from the card (Option A: released at 90° of flip) */}
        {hasVoted && player.pokemon.sprite && (
          <>
            {/* Single radial-gradient flash (no filter — much cheaper than blur) */}
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-6 -translate-x-1/2 w-28 h-28 rounded-full pointer-events-none z-0"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,158,11,0.7) 30%, rgba(245,158,11,0) 70%)',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={
                showRevealed
                  ? { opacity: [0, 0.9, 0], scale: [0.3, 1.4, 1.9] }
                  : { opacity: 0, scale: 0.3 }
              }
              transition={
                showRevealed
                  ? {
                      delay: emergeDelaySec,
                      duration: 0.65,
                      times: [0, 0.35, 1],
                      ease: 'easeOut',
                    }
                  : { duration: 0.2 }
              }
            />

            {/* Pokémon wrapper: burst emergence */}
            <motion.div
              className="absolute left-1/2 top-0 z-20 pointer-events-none w-24 h-24"
              style={{ x: '-50%', willChange: 'transform, opacity' }}
              initial={{ scale: 0, opacity: 0, y: 24, rotate: -18 }}
              animate={
                showRevealed
                  ? {
                      scale: [0, 1.3, 1.05],
                      opacity: [0, 1, 1],
                      y: -52,
                      rotate: 0,
                    }
                  : { scale: 0, opacity: 0, y: 24, rotate: -18 }
              }
              transition={
                showRevealed
                  ? {
                      scale: {
                        delay: emergeDelaySec,
                        duration: EMERGE_DURATION_S,
                        times: [0, 0.35, 1],
                        ease: [0.34, 1.56, 0.64, 1],
                      },
                      opacity: {
                        delay: emergeDelaySec,
                        duration: 0.4,
                        times: [0, 0.4, 1],
                      },
                      y: {
                        delay: emergeDelaySec,
                        type: 'spring',
                        stiffness: 200,
                        damping: 13,
                      },
                      rotate: {
                        delay: emergeDelaySec,
                        duration: 0.6,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    }
                  : { duration: 0.25 }
              }
            >
              {/* Inner: idle bob + celebration dance (no filter — drop-shadow is expensive on animated elements) */}
              <motion.img
                src={player.pokemon.sprite}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="w-full h-full object-contain"
                style={{ willChange: 'transform' }}
                animate={
                  celebrating
                    ? {
                        y: [0, -10, 0],
                        rotate: [0, -8, 0],
                        scale: [1, 1.12, 1],
                      }
                    : emerged
                      ? { y: [0, -3, 0] }
                      : { y: 0, rotate: 0, scale: 1 }
                }
                transition={
                  celebrating
                    ? {
                        duration: 0.85,
                        ease: 'easeInOut',
                        repeat: 1,
                        repeatType: 'reverse',
                      }
                    : emerged
                      ? {
                          duration: 2.6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                      : { duration: 0.2 }
                }
              />
            </motion.div>
          </>
        )}

        {/* 3D flip scene */}
        <div
          className="relative z-10 w-full h-full"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
            animate={{
              rotateY: showRevealed ? 180 : 0,
            }}
            transition={{
              rotateY: {
                duration: FLIP_DURATION_S,
                delay: showRevealed ? delaySec : 0,
                ease: [0.34, 1.56, 0.64, 1],
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

// Memoize: prevent re-renders when only sibling state changes (e.g. another card's
// flipDelayMs) but our own props are unchanged. Compares the player object by
// the fields we actually render rather than reference.
export const PlayerCard = memo(PlayerCardInner, (a, b) => {
  if (a.revealed !== b.revealed) return false;
  if (a.isSelf !== b.isSelf) return false;
  if (a.flipDelayMs !== b.flipDelayMs) return false;
  if (a.enterDelayMs !== b.enterDelayMs) return false;
  if (a.shaking !== b.shaking) return false;
  if (a.glowing !== b.glowing) return false;
  if (a.charging !== b.charging) return false;
  if (a.flipReady !== b.flipReady) return false;
  if (a.isOutlier !== b.isOutlier) return false;
  if (a.isWaiting !== b.isWaiting) return false;
  if (a.celebrating !== b.celebrating) return false;
  const pa = a.player;
  const pb = b.player;
  return (
    pa.id === pb.id &&
    pa.name === pb.name &&
    pa.role === pb.role &&
    pa.online === pb.online &&
    pa.vote === pb.vote &&
    pa.pokemon.id === pb.pokemon.id &&
    pa.pokemon.sprite === pb.pokemon.sprite
  );
});

