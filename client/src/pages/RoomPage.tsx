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
import { EvolutionOverlay } from '../components/EvolutionOverlay';
import { EeveeStoneDialog } from '../components/EeveeStoneDialog';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { computeStats, someoneVoted as anyoneVoted } from '../utils/stats';
import { clearSession, readSession } from '../services/session';
import { signOut, useSession } from '../services/auth';
import { useTrainer } from '../hooks/useTrainer';
import { disconnectSocket } from '../services/socket';
import { normalizeRoomId } from '../types';
import {
  deleteRoom,
  getRoom,
  renameRoom,
  setFavorite,
  RoomApiError,
} from '../services/rooms';
import type { CardValue, PlayerRole, SerializedPlayer } from '../types';

const DEFAULT_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

// Constante de modulo: `?? []` inline alocaria um array novo a cada render e
// invalidaria o memo de computeStats sem necessidade.
const NO_PLAYERS: SerializedPlayer[] = [];

export default function RoomPage() {
  const { roomId: rawRoomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const { data: session } = useSession();
  const { active: trainerActive } = useTrainer();
  const userId = session?.user?.id ?? null;

  // Sem canonicalizar, /room/abc e /room/ABC eram salas diferentes.
  const roomId = normalizeRoomId(rawRoomId) ?? '';
  const { join, leave, castVote, reveal, reset, clearInactive } = useRoom(roomId);

  const [settingsOpen, setSettingsOpen] = useState(false);
  // O prefetch REST existe para UX: você descobre que a sala nao existe ANTES
  // de digitar nome e escolher Pokemon. A autoridade continua sendo o socket,
  // que cobre a corrida entre este fetch e o join.
  const [metaState, setMetaState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [isFavorite, setIsFavorite] = useState(false);
  // Nome vindo do prefetch: o EntryDialog precisa dele ANTES do join, quando o
  // `roomState` (que traz o nome pelo socket) ainda nao existe.
  const [prefetchedName, setPrefetchedName] = useState<string | null>(null);

  const roomState = useRoomStore((s) => s.roomState);
  const myPlayerId = useRoomStore((s) => s.myPlayerId);
  const joining = useRoomStore((s) => s.joining);
  const joined = useRoomStore((s) => s.joined);
  const error = useRoomStore((s) => s.error);
  const closed = useRoomStore((s) => s.closed);
  const roundResult = useRoomStore((s) => s.roundResult);
  const setCeremonyBusy = useRoomStore((s) => s.setCeremonyBusy);
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

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setMetaState('loading');
    getRoom(roomId)
      .then((room) => {
        if (cancelled) return;
        setIsFavorite(room.isFavorite);
        setPrefetchedName(room.name);
        setMetaState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        // SO o 404 bloqueia. Rede instavel ou banco fora (503) nao podem
        // impedir a entrada: o socket sabe entrar numa sala ja viva em memoria
        // mesmo com o Postgres fora do ar, e e ele quem decide.
        setMetaState(err instanceof RoomApiError && err.status === 404 ? 'missing' : 'ok');
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

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
    // Sem condicao de pokemon: ele nao vive mais na sessao da aba.
    if (!stored?.name) return;
    autoJoinedRef.current = true;
    setEntryData({ name: stored.name, role: stored.role });
    join(stored.name, stored.role);
  }, [roomId, userId, connected, joined, joining, join, setEntryData]);

  // O dono excluiu a sala com a gente dentro: sai da mesa e leva o aviso para a
  // home pelo `location.state`, do mesmo jeito que o RequireAuth passa o `from`.
  useEffect(() => {
    if (!closed) return;
    if (userId) clearSession(userId, roomId);
    resetStore();
    navigate('/', { replace: true, state: { notice: 'ROOM_DELETED' } });
  }, [closed, userId, roomId, resetStore, navigate]);

  const handleEntry = (data: { name: string; role: PlayerRole }) => {
    setEntryData(data);
    join(data.name, data.role);
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

  // Otimista com rollback: a estrela e um toggle, e esperar o round-trip para
  // pintar deixaria o clique com cara de travado.
  const handleToggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await setFavorite(roomId, next);
    } catch {
      setIsFavorite(!next);
    }
  };

  // O nome novo chega de volta pelo `room:state` (o servidor rebroadcasta), so
  // que so para quem esta na sala -- por isso aqui nao ha setState local.
  const handleRename = async (name: string) => {
    await renameRoom(roomId, name);
  };

  // Nao navega: o proprio dono recebe o `room:closed` que o servidor difunde,
  // e o efeito la em cima cuida da saida para todo mundo por um caminho so.
  const handleDelete = async () => {
    await deleteRoom(roomId);
  };

  const players = roomState?.players ?? NO_PLAYERS;
  const revealed = roomState?.revealed ?? false;
  const sequence = roomState?.cardSequence ?? DEFAULT_SEQUENCE;

  const myPlayer = useMemo(
    () => players.find((p) => p.id === myPlayerId) ?? null,
    [players, myPlayerId],
  );

  const stats = useMemo(() => computeStats(players), [players]);

  // XP da rodada por jogador. Vem PRONTO do servidor (`round:result`): o cliente
  // não recalcula, senão poderia mostrar um número diferente do que foi gravado.
  const gainByPlayerId = useMemo(() => {
    if (!roundResult) return undefined;
    const map: Record<string, number> = {};
    for (const entry of roundResult.xp) map[entry.playerId] = entry.gained;
    return map;
  }, [roundResult]);

  // O seletor de pedra é só do dono do Eevee: a condição sai do progresso do
  // PRÓPRIO jogador, nunca da mesa.
  const needsStone =
    myPlayer?.progress?.pendingChoice === true && trainerActive !== null;

  // O servidor manda o estado ja na perspectiva de quem recebe: cada jogador ve
  // o proprio voto sem mascara. Por isso nao existe mais estado local otimista
  // -- a carta destacada e sempre a que o servidor registrou de fato.
  const myVote = (myPlayer?.vote ?? null) as CardValue | null;

  const deckDisabled = !joined || revealed;

  const canReveal = !revealed && anyoneVoted(players);

  const hasInactive = players.some((p) => !p.online);

  // Sala inexistente: fala isso NA PROPRIA URL, sem redirect. Mandar de volta
  // para a home em silencio faria um 404 legitimo parecer bug e destruiria o
  // codigo que a pessoa estava tentando abrir.
  const missing = metaState === 'missing' || error?.code === 'ROOM_NOT_FOUND';
  if (missing) {
    return (
      <div className="min-h-screen bg-dot-grid flex flex-col items-center justify-center px-4 animate-fade-in">
        <PokeballIcon size={26} className="text-subtle mb-6" />
        <h1 className="text-lg font-semibold text-text tracking-tight mb-2">
          Sala não encontrada
        </h1>
        <p className="text-sm text-muted text-center max-w-xs mb-1">
          O código <span className="font-mono text-text">{roomId}</span> não existe
          ou a sala foi encerrada pelo dono.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  if (metaState === 'loading' && !joined) {
    return (
      <div className="min-h-screen bg-dot-grid flex items-center justify-center">
        <PokeballIcon spinning size={28} className="text-muted/60" />
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-dot-grid">
        <EntryDialog
          open={!joined}
          roomId={roomId}
          roomName={prefetchedName}
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
        onToggleFavorite={handleToggleFavorite}
        hasInactive={hasInactive}
        isFavorite={isFavorite}
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

      {/* Acima do Confetti (z-40) e do Dialog (z-50): ver EvolutionOverlay. */}
      <EvolutionOverlay />

      {needsStone && trainerActive && <EeveeStoneDialog pokemon={trainerActive} />}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        roomName={roomState?.name ?? roomId}
        playerCount={players.length}
        isOwner={roomState?.isOwner ?? false}
        onRename={handleRename}
        onDelete={handleDelete}
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
                gainByPlayerId={gainByPlayerId}
                onCeremonyBusyChange={setCeremonyBusy}
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
                  {roomState?.name ?? 'Sala'} ·{' '}
                  <span className="text-muted">{roomId}</span>
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
