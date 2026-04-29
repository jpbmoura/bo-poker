import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoomStore } from '../store/useRoomStore';
import { useRoom } from '../hooks/useRoom';
import { useSocket } from '../hooks/useSocket';
import { EntryDialog } from '../components/EntryDialog';
import { RoomHeader } from '../components/RoomHeader';
import { PokerTable } from '../components/PokerTable';
import { CardDeck } from '../components/CardDeck';
import { StatsPanel } from '../components/StatsPanel';
import { RoomControls } from '../components/RoomControls';
import { PlayerList } from '../components/PlayerList';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { computeStats } from '../utils/stats';
import type { CardValue, PlayerRole, Pokemon } from '../types';

const DEFAULT_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const { join, leave, castVote, reveal, reset, setRole } = useRoom(roomId);

  const roomState = useRoomStore((s) => s.roomState);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const myRole = useRoomStore((s) => s.myRole);
  const joining = useRoomStore((s) => s.joining);
  const joined = useRoomStore((s) => s.joined);
  const error = useRoomStore((s) => s.error);
  const setEntryData = useRoomStore((s) => s.setEntryData);
  const setLocalRole = useRoomStore((s) => s.setRole);
  const resetStore = useRoomStore((s) => s.reset);

  // Reset store when room changes
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

  const handleToggleRole = () => {
    const next: PlayerRole = myRole === 'spectator' ? 'voter' : 'spectator';
    setLocalRole(next);
    setRole(next);
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

  const deckDisabled =
    !joined ||
    revealed ||
    (myPlayer?.role ?? myRole) === 'spectator';

  const someoneVoted = players.some((p) => p.role === 'voter' && p.vote !== null);
  const canReveal = !revealed && someoneVoted;

  return (
    <div className="min-h-screen flex flex-col">
      {!joined && (
        <EntryDialog
          open={!joined}
          roomId={roomId}
          joining={joining}
          error={error}
          onSubmit={handleEntry}
        />
      )}

      {joined && (
        <>
          <RoomHeader roomId={roomId} playerCount={players.length} />

          {!connected && (
            <div className="bg-danger/10 border-b border-danger/30 text-danger text-xs text-center py-1.5">
              Reconectando ao servidor...
            </div>
          )}

          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-6">
              {!roomState ? (
                <div className="flex-1 flex items-center justify-center text-muted">
                  <PokeballIcon spinning size={32} className="text-accent/60" />
                </div>
              ) : (
                <>
                  <PokerTable
                    players={players}
                    revealed={revealed}
                    myPlayerId={myPlayerId}
                    consensus={stats.consensus}
                    canReveal={canReveal}
                    onReveal={reveal}
                    onReset={reset}
                  />

                  <StatsPanel stats={stats} visible={revealed} />

                  <div className="flex flex-col gap-2">
                    <CardDeck
                      sequence={sequence}
                      selected={myVote}
                      disabled={deckDisabled}
                      onSelect={castVote}
                    />
                    <RoomControls
                      role={myRole}
                      onToggleRole={handleToggleRole}
                      onLeave={handleLeave}
                    />
                  </div>
                </>
              )}
            </div>

            <PlayerList
              players={players}
              myPlayerId={myPlayerId}
              revealed={revealed}
            />
          </main>
        </>
      )}
    </div>
  );
}
