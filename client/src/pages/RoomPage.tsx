import { useEffect, useMemo, useRef, useState } from 'react';
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
import { computeStats, someoneVoted as anyoneVoted } from '../utils/stats';
import { clearSession, readSession } from '../services/session';
import { signOut, useSession } from '../services/auth';
import { disconnectSocket } from '../services/socket';
import { normalizeRoomId } from '../types';
import type { CardValue, PlayerRole, Pokemon, SerializedPlayer } from '../types';

const DEFAULT_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

// Constante de modulo: `?? []` inline alocaria um array novo a cada render e
// invalidaria o memo de computeStats sem necessidade.
const NO_PLAYERS: SerializedPlayer[] = [];

export default function RoomPage() {
  const { roomId: rawRoomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  // Sem canonicalizar, /room/abc e /room/ABC eram salas diferentes.
  const roomId = normalizeRoomId(rawRoomId) ?? '';
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
    if (!roomId) {
      navigate('/', { replace: true });
      return;
    }
    if (roomId !== rawRoomId) {
      navigate(`/room/${roomId}`, { replace: true });
    }
  }, [roomId, rawRoomId, navigate]);

  useEffect(() => {
    return () => {
      resetStore();
    };
  }, [roomId, resetStore]);

  // Reentrada automatica: com uma sessao salva nesta aba, o F5 volta direto
  // para a mesa em vez de reabrir o dialogo (e sem criar um assento novo).
  // A reconexao depois de queda e tratada pelo handler de `connect` no useRoom;
  // aqui cobrimos o caso do socket ja estar conectado na montagem.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (!roomId || !userId || !connected || joined || joining || autoJoinedRef.current) {
      return;
    }
    const stored = readSession(userId, roomId);
    if (!stored?.name || !stored.pokemon) return;
    autoJoinedRef.current = true;
    setEntryData({ name: stored.name, pokemon: stored.pokemon, role: stored.role });
    join(stored.name, stored.pokemon, stored.role);
  }, [roomId, userId, connected, joined, joining, join, setEntryData]);

  const handleEntry = (data: { name: string; pokemon: Pokemon; role: PlayerRole }) => {
    setEntryData(data);
    join(data.name, data.pokemon, data.role);
  };

  const handleLeave = () => {
    leave();
    if (userId) clearSession(userId, roomId);
    resetStore();
    navigate('/');
  };

  // Sair da CONTA (diferente de sair da sala): libera o assento antes de
  // encerrar a sessao, coerente com a regra de que saida deliberada nao deixa
  // fantasma na mesa. O assign no fim zera todo o estado de modulo.
  const handleSignOut = async () => {
    if (joined) leave();
    if (userId) clearSession(userId, roomId);
    resetStore();
    disconnectSocket();
    await signOut();
    window.location.assign('/login');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  };

  const players = roomState?.players ?? NO_PLAYERS;
  const revealed = roomState?.revealed ?? false;
  const sequence = roomState?.cardSequence ?? DEFAULT_SEQUENCE;

  const myPlayer = useMemo(
    () => players.find((p) => p.id === myPlayerId) ?? null,
    [players, myPlayerId],
  );

  const stats = useMemo(() => computeStats(players), [players]);

  // O servidor manda o estado ja na perspectiva de quem recebe: cada jogador ve
  // o proprio voto sem mascara. Por isso nao existe mais estado local otimista
  // -- a carta destacada e sempre a que o servidor registrou de fato.
  const myVote = (myPlayer?.vote ?? null) as CardValue | null;

  const deckDisabled = !joined || revealed;

  const canReveal = !revealed && anyoneVoted(players);

  const hasInactive = players.some((p) => !p.online);

  if (!joined) {
    return (
      <div className="min-h-screen bg-dot-grid">
        <EntryDialog
          open={!joined}
          roomId={roomId}
          joining={joining}
          connected={connected}
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

      <TopActions me={myPlayer} onSignOut={handleSignOut} />

      {roomState && (
        <div className="fixed top-6 left-14 right-0 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto animate-fade-up flex flex-col items-center gap-2">
            {!revealed ? (
              <>
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
                {stats.votingPlayers > 0 && (
                  <span
                    className={cn(
                      'text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors',
                      canReveal
                        ? 'text-text border-border-strong bg-surface-2/80 backdrop-blur'
                        : 'text-subtle border-border bg-surface-2/50',
                    )}
                  >
                    {stats.votedCount === 0
                      ? 'Aguardando votos...'
                      : `${stats.votedCount}/${stats.votingPlayers} votaram`}
                  </span>
                )}
              </>
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
                outlierIds={stats.outlierIds}
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
