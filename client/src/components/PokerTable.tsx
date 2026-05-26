import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Sparkles, Zap, ThumbsUp } from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { Confetti } from './Confetti';
import { PokeballIcon } from './ui/PokeballIcon';
import { cn } from '../utils/cn';
import type { SerializedPlayer } from '../types';

interface PokerTableProps {
  players: SerializedPlayer[];
  revealed: boolean;
  myPlayerId: string | null;
  consensus: boolean;
  outlierIds: Set<string>;
}

const PREP_MS = 380;
const FLIP_BASE_MS = 700;
const WAVE_STEP_MS = 120;

type Verdict = 'consensus' | 'outliers' | 'near' | null;

function voteRank(p: SerializedPlayer): number {
  const v = p.vote;
  if (v === null) return Number.POSITIVE_INFINITY;
  if (v === 'HIDDEN') return Number.POSITIVE_INFINITY;
  if (v === '?') return Number.POSITIVE_INFINITY - 1;
  const n = Number(v);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

function isNumericVote(v: SerializedPlayer['vote']): boolean {
  return v !== null && v !== 'HIDDEN' && v !== '?' && !Number.isNaN(Number(v));
}

function computeVerdict(
  voters: SerializedPlayer[],
  consensus: boolean,
  outlierIds: Set<string>,
): Verdict {
  if (consensus) return 'consensus';
  if (outlierIds.size > 0) return 'outliers';
  const numericVotes = voters.filter((p) => isNumericVote(p.vote)).map((p) => Number(p.vote));
  if (numericVotes.length >= 2) {
    const min = Math.min(...numericVotes);
    const max = Math.max(...numericVotes);
    if (max - min <= 2) return 'near';
  }
  return null;
}

interface VerdictBannerProps {
  verdict: Exclude<Verdict, null>;
}

function VerdictBanner({ verdict }: VerdictBannerProps) {
  const config = {
    consensus: {
      Icon: Sparkles,
      text: 'Super efetivo!',
      classes: 'text-highlight drop-shadow-[0_2px_18px_rgba(245,158,11,0.6)]',
      scale: 1,
    },
    outliers: {
      Icon: Zap,
      text: 'Eficácia variável',
      classes: 'text-highlight drop-shadow-[0_2px_12px_rgba(245,158,11,0.4)]',
      scale: 0.95,
    },
    near: {
      Icon: ThumbsUp,
      text: 'Boa convergência',
      classes: 'text-success drop-shadow-[0_2px_10px_rgba(34,197,94,0.35)]',
      scale: 0.9,
    },
  }[verdict];

  const Icon = config.Icon;

  return (
    <motion.div
      key={verdict}
      initial={{ opacity: 0, y: 12, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: config.scale }}
      exit={{ opacity: 0, y: -8, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -top-14 whitespace-nowrap flex items-center gap-2 pointer-events-none',
        config.classes,
      )}
    >
      <Icon size={20} strokeWidth={2.4} />
      <span className="text-xl font-bold tracking-tight">{config.text}</span>
    </motion.div>
  );
}

export function PokerTable({
  players,
  revealed,
  myPlayerId,
  consensus,
  outlierIds,
}: PokerTableProps) {
  const [charging, setCharging] = useState(false);
  const [flipReady, setFlipReady] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>(null);

  const prevRevealedRef = useRef(false);

  const voters = useMemo(() => players.filter((p) => p.role === 'voter'), [players]);
  const spectators = useMemo(() => players.filter((p) => p.role === 'spectator'), [players]);

  // Snapshot refs read inside the reveal effect so it can depend ONLY on `revealed`
  // (player updates during the reveal won't tear down active timers).
  const votersRef = useRef(voters);
  const consensusRef = useRef(consensus);
  const outlierIdsRef = useRef(outlierIds);
  votersRef.current = voters;
  consensusRef.current = consensus;
  outlierIdsRef.current = outlierIds;

  const displayedVoters = useMemo(() => {
    if (!sorted) return voters;
    return [...voters].sort((a, b) => voteRank(a) - voteRank(b));
  }, [voters, sorted]);

  // Center-out wave delays (in ms)
  const flipDelays = useMemo(() => {
    const n = displayedVoters.length;
    if (n === 0) return [] as number[];
    const center = (n - 1) / 2;
    return displayedVoters.map((_, i) => Math.abs(i - center) * WAVE_STEP_MS);
  }, [displayedVoters]);

  // Effect runs ONLY when `revealed` toggles. Player updates during the reveal
  // can't tear down the active timers — snapshot is read from refs at run time.
  useEffect(() => {
    if (!revealed) {
      prevRevealedRef.current = false;
      setCharging(false);
      setFlipReady(false);
      setSorted(false);
      setShaking(false);
      setGlowing(false);
      setCelebrating(false);
      setConfetti(false);
      setVerdict(null);
      return;
    }

    if (prevRevealedRef.current) return;
    prevRevealedRef.current = true;

    // Snapshot at reveal moment
    const snapVoters = votersRef.current;
    const snapConsensus = consensusRef.current;
    const snapOutliers = outlierIdsRef.current;
    const voterCount = snapVoters.length;
    const center = (voterCount - 1) / 2;
    const maxDelay = voterCount > 0
      ? Math.max(...snapVoters.map((_, i) => Math.abs(i - center) * WAVE_STEP_MS))
      : 0;
    const localTotalFlipMs = maxDelay + FLIP_BASE_MS;
    const flipEnd = PREP_MS + localTotalFlipMs;
    const v = computeVerdict(snapVoters, snapConsensus, snapOutliers);

    setCharging(true);

    const timeouts: number[] = [];
    timeouts.push(window.setTimeout(() => {
      setCharging(false);
      setFlipReady(true);
    }, PREP_MS));
    timeouts.push(window.setTimeout(() => setSorted(true), flipEnd + 250));
    timeouts.push(window.setTimeout(() => setVerdict(v), flipEnd + 200));

    if (v === 'consensus') {
      timeouts.push(window.setTimeout(() => {
        setShaking(true);
        setGlowing(true);
        setCelebrating(true);
        setConfetti(true);
      }, flipEnd + 300));
      timeouts.push(window.setTimeout(() => setShaking(false), flipEnd + 900));
      timeouts.push(window.setTimeout(() => setCelebrating(false), flipEnd + 1200));
      timeouts.push(window.setTimeout(() => setConfetti(false), flipEnd + 3400));
      timeouts.push(window.setTimeout(() => setGlowing(false), flipEnd + 3600));
      timeouts.push(window.setTimeout(() => setVerdict(null), flipEnd + 3000));
    } else if (v === 'outliers') {
      timeouts.push(window.setTimeout(() => setVerdict(null), flipEnd + 3500));
    } else if (v === 'near') {
      timeouts.push(window.setTimeout(() => setVerdict(null), flipEnd + 2800));
    }

    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [revealed]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <Confetti active={confetti} />

      {/* Subtle screen vignette during charging */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: charging ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.35) 90%)',
        }}
      />

      <div className="relative w-full">
        <AnimatePresence>
          {verdict && <VerdictBanner verdict={verdict} />}
        </AnimatePresence>

        {voters.length === 0 ? (
          <div className="text-center py-10 text-subtle text-sm animate-fade-in">
            Esperando jogadores entrarem...
          </div>
        ) : (
          <LayoutGroup>
            <motion.div
              layout
              className="flex flex-wrap justify-center items-end gap-x-8 gap-y-16"
            >
              {displayedVoters.map((player, idx) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  revealed={revealed}
                  isSelf={player.id === myPlayerId}
                  flipDelayMs={flipDelays[idx] ?? 0}
                  enterDelayMs={idx * 60}
                  shaking={shaking}
                  glowing={glowing}
                  charging={charging}
                  flipReady={flipReady}
                  isOutlier={revealed && flipReady && outlierIds.has(player.id)}
                  isWaiting={!revealed && player.vote === null && player.online}
                  celebrating={celebrating}
                />
              ))}
            </motion.div>
          </LayoutGroup>
        )}
      </div>

      {/* Spectators row */}
      {spectators.length > 0 && (
        <div className="mt-10 flex items-center gap-2 animate-fade-in">
          <span className="text-[10px] uppercase tracking-[0.18em] text-subtle">
            Assistindo
          </span>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {spectators.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-surface-2/70 border border-border',
                  !s.online && 'opacity-50',
                )}
                title={s.name}
              >
                <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden">
                  {s.pokemon.sprite ? (
                    <img
                      src={s.pokemon.sprite}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <PokeballIcon size={10} className="text-subtle" />
                  )}
                </div>
                <span className="text-[11px] text-muted truncate max-w-[100px]">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
