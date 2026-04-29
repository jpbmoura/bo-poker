import { useEffect, useState } from 'react';
import { PlayerCard } from './PlayerCard';
import { Button } from './ui/Button';
import type { SerializedPlayer } from '../types';

interface PokerTableProps {
  players: SerializedPlayer[];
  revealed: boolean;
  myPlayerId: string | null;
  consensus: boolean;
  canReveal: boolean;
  onReveal: () => void;
  onReset: () => void;
}

export function PokerTable({
  players,
  revealed,
  myPlayerId,
  consensus,
  canReveal,
  onReveal,
  onReset,
}: PokerTableProps) {
  const [showConsensus, setShowConsensus] = useState(false);
  const [shaking, setShaking] = useState(false);

  // When transitioning to revealed + consensus, trigger animation after the flips finish.
  useEffect(() => {
    if (!revealed || !consensus) {
      setShowConsensus(false);
      setShaking(false);
      return;
    }
    const flipTotal = 600 + players.length * 80;
    const t1 = window.setTimeout(() => {
      setShaking(true);
      setShowConsensus(true);
    }, flipTotal);
    const t2 = window.setTimeout(() => setShaking(false), flipTotal + 400);
    const t3 = window.setTimeout(() => setShowConsensus(false), flipTotal + 1800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [revealed, consensus, players.length]);

  return (
    <div className="relative w-full">
      <div className="relative mx-auto rounded-[40px] bg-surface border border-border px-8 py-12 min-h-[280px] shadow-sm">
        {showConsensus && (
          <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
            <span className="text-2xl font-bold text-highlight animate-pop-in drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
              ✨ Super efetivo!
            </span>
          </div>
        )}

        {players.length === 0 ? (
          <div className="text-center py-10 text-muted">
            Esperando jogadores entrarem...
          </div>
        ) : (
          <div className="flex flex-wrap justify-center items-end gap-x-8 gap-y-6">
            {players.map((player, idx) => (
              <PlayerCard
                key={player.id}
                player={player}
                revealed={revealed}
                isSelf={player.id === myPlayerId}
                flipDelayMs={idx * 80}
                shaking={shaking}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center gap-3">
          {!revealed ? (
            <Button onClick={onReveal} disabled={!canReveal}>
              Revelar cartas
            </Button>
          ) : (
            <Button onClick={onReset} variant="primary">
              Nova rodada
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
