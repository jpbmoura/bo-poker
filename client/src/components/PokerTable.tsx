import { useEffect, useState } from 'react';
import { PlayerCard } from './PlayerCard';
import { Confetti } from './Confetti';
import type { SerializedPlayer } from '../types';

interface PokerTableProps {
  players: SerializedPlayer[];
  revealed: boolean;
  myPlayerId: string | null;
  consensus: boolean;
}

export function PokerTable({
  players,
  revealed,
  myPlayerId,
  consensus,
}: PokerTableProps) {
  const [showConsensus, setShowConsensus] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    if (!revealed) {
      setShowConsensus(false);
      setShaking(false);
      setGlowing(false);
      setConfetti(false);
      setRisen(false);
      return;
    }

    const flipTotal = 600 + players.length * 80;
    const tRise = window.setTimeout(() => setRisen(true), flipTotal + 500);

    if (!consensus) {
      return () => window.clearTimeout(tRise);
    }

    const t1 = window.setTimeout(() => {
      setShaking(true);
      setGlowing(true);
      setShowConsensus(true);
      setConfetti(true);
    }, flipTotal);
    const t2 = window.setTimeout(() => setShaking(false), flipTotal + 600);
    const t3 = window.setTimeout(() => setShowConsensus(false), flipTotal + 2200);
    const t4 = window.setTimeout(() => {
      setConfetti(false);
      setGlowing(false);
    }, flipTotal + 2800);
    return () => {
      window.clearTimeout(tRise);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [revealed, consensus, players.length]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <Confetti active={confetti} />

      {/* Consensus banner — floats above the cards without shifting layout */}
      <div className="relative w-full">
        {showConsensus && (
          <span className="absolute left-1/2 -translate-x-1/2 -top-12 whitespace-nowrap text-base font-bold text-highlight animate-pop-in drop-shadow-[0_2px_12px_rgba(245,158,11,0.5)] pointer-events-none">
            ✨ Super efetivo!
          </span>
        )}

        {players.length === 0 ? (
          <div className="text-center py-10 text-subtle text-sm animate-fade-in">
            Esperando jogadores entrarem...
          </div>
        ) : (
          <div className="flex flex-wrap justify-center items-end gap-x-8 gap-y-16">
            {players.map((player, idx) => (
              <PlayerCard
                key={player.id}
                player={player}
                revealed={revealed}
                isSelf={player.id === myPlayerId}
                flipDelayMs={idx * 80}
                enterDelayMs={idx * 60}
                shaking={shaking}
                glowing={glowing}
                risen={risen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
