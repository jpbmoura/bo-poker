import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PokeballIcon } from './ui/PokeballIcon';
import { Button } from './ui/Button';

interface RoomHeaderProps {
  roomId: string;
  playerCount: number;
}

export function RoomHeader({ roomId, playerCount }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text hover:text-muted transition-colors"
        >
          <PokeballIcon size={20} className="text-accent" />
          <span className="font-bold">BO Poker</span>
        </button>

        <div className="flex items-center gap-3 text-sm">
          <div className="text-muted">
            Sala: <span className="font-mono text-text">{roomId}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleCopy}>
            {copied ? '✓ Copiado' : '🔗 Copiar link'}
          </Button>
          <div className="text-muted hidden sm:block">
            {playerCount} {playerCount === 1 ? 'jogador' : 'jogadores'}
          </div>
        </div>
      </div>
    </header>
  );
}
