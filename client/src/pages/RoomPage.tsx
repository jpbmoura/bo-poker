import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoomStore } from '../store/useRoomStore';
import { useRoom } from '../hooks/useRoom';
import { useSocket } from '../hooks/useSocket';
import { EntryDialog } from '../components/EntryDialog';
import { PokerTable } from '../components/PokerTable';
import { CardDeck } from '../components/CardDeck';
import { StatsPanel } from '../components/StatsPanel';
import { IconSidebar } from '../components/IconSidebar';
import { TopActions } from '../components/TopActions';
import { SettingsDialog } from '../components/SettingsDialog';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { computeStats } from '../utils/stats';
import type { CardValue, PlayerRole, Pokemon } from '../types';

const DEFAULT_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const { join, leave, castVote, reveal, reset, clearInactive } = useRoom(roomId);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const roomState = useRoomStore((s) => s.roomState);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const joining = useRoomStore((s) => s.joining);
  const joined = useRoomStore((s) => s.joined);
  const error = useRoomStore((s) => s.error);
  const setEntryData = useRoomStore((s) => s.setEntryData);
  const resetStore = useRoomStore((s) => s.reset);

  useEffect(() => {
    return () => {
      resetStore();
    };
  }, [roomId, resetStore]);

  const handleEntry = (data: { name: string; pokemon: Pokemon; role: PlayerRole }) => {
    setEntryData(data);
    join(data.name, data.pokemon, data.role);
  };

  const handleLeave = () => {
    leave();
    resetStore();
    navigate('/');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  };

  const players = roomState?.players ?? [];
  const revealed = roomState?.revealed ?? false;
  const sequence = roomState?.cardSequence ?? DEFAULT_SEQUENCE;

  const myPlayer = useMemo(
    () => players.find((p) => p.id === myPlayerId) ?? null,
    [players, myPlayerId],
  );

  const stats = useMemo(() => computeStats(players), [players]);

  const myVote: CardValue | null =
    myPlayer && myPlayer.vote !== 'HIDDEN' ? (myPlayer.vote as CardValue | null) : null;

  const deckDisabled = !joined || revealed;

  const someoneVoted = players.some((p) => p.role === 'voter' && p.vote !== null);
  const canReveal = !revealed && someoneVoted;

  const hasInactive = players.some((p) => !p.online);

  if (!joined) {
    return (
      <div className="min-h-screen bg-dot-grid">
        <EntryDialog
          open={!joined}
          roomId={roomId}
          joining={joining}
          error={error}
          onSubmit={handleEntry}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dot-grid animate-fade-in">
      <IconSidebar
        onCopyLink={handleCopyLink}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearInactive={clearInactive}
        onLeave={handleLeave}
        onHome={() => navigate('/')}
        hasInactive={hasInactive}
      />

      <TopActions me={myPlayer} />

      {roomState && (
        <div className="fixed top-6 left-14 right-0 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto animate-fade-up">
            {!revealed ? (
              <Button
                variant="primary"
                size="lg"
                onClick={reveal}
                disabled={!canReveal}
                className={cn(
                  'min-w-[160px] press-down',
                  canReveal && 'animate-pulse-glow',
                )}
              >
                Revelar
              </Button>
            ) : (
              <Button
                variant="solid"
                size="lg"
                onClick={reset}
                className="min-w-[160px] press-down"
              >
                Nova rodada
              </Button>
            )}
          </div>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        playerCount={players.length}
      />

      {!connected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-danger-soft border border-danger/30 text-danger text-xs rounded-full backdrop-blur animate-fade-in">
          Reconectando ao servidor...
        </div>
      )}

      <main className="pl-14 min-h-screen flex flex-col">
        {!roomState ? (
          <div className="flex-1 flex items-center justify-center text-muted">
            <PokeballIcon spinning size={28} className="text-muted/60" />
          </div>
        ) : (
          <>
            {/* Center area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-12">
              <PokerTable
                players={players}
                revealed={revealed}
                myPlayerId={myPlayerId}
                consensus={stats.consensus}
              />

              <StatsPanel stats={stats} visible={revealed} />
            </div>

            {/* Bottom deck */}
            <div className="pb-8 pt-4">
              <CardDeck
                sequence={sequence}
                selected={myVote}
                disabled={deckDisabled}
                onSelect={castVote}
              />
              <div className="mt-4 flex justify-center">
                <span className="px-3 py-1 text-[11px] font-mono text-subtle border border-border rounded-full">
                  Sala · <span className="text-muted">{roomId}</span>
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
