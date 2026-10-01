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
import { BranchChoiceDialog } from '../components/BranchChoiceDialog';
import { Copy, Eye } from 'lucide-react';
import { RoundControl } from '../components/RoundControl';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { Button } from '../components/ui/Button';
import { computeStats, someoneVoted as anyoneVoted } from '../utils/stats';
import {
  clearSession,
  readSession,
  writePreferredRole,
  writeSession,
} from '../services/session';
import { signOut, useSession } from '../services/auth';
import { useTrainer } from '../hooks/useTrainer';
import { disconnectSocket } from '../services/socket';
import { normalizeRoomId } from '../types';
import { toast } from '../store/useToastStore';
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
  const { pokemon: trainerPokemon, status: trainerStatus, reload: reloadTrainer } = useTrainer();
  const userId = session?.user?.id ?? null;

  // Sem canonicalizar, /room/abc e /room/ABC eram salas diferentes.
  const roomId = normalizeRoomId(rawRoomId) ?? '';
  const { join, leave, castVote, reveal, reset, clearInactive, setRole } = useRoom(roomId);

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
  const setMyRole = useRoomStore((s) => s.setRole);
  const myName = useRoomStore((s) => s.myName);
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

  // Depois do join o EntryDialog some, então erros do servidor (ex.: "Você não
  // está mais na sala") só apareceriam no store. Mostra como toast.
  useEffect(() => {
    if (joined && error && error.code !== 'ROOM_NOT_FOUND') toast.error(error.message);
  }, [joined, error]);

  const handleClearInactive = () => {
    clearInactive();
    toast.success('Jogadores inativos removidos da mesa');
  };

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
      toast.success('Link copiado. Mande para o time.');
      return true;
    } catch {
      toast.error('Não foi possível copiar o link.');
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
      toast.error('Não foi possível atualizar os favoritos. Tente de novo.');
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

  // O seletor de ramo (pedra do Eevee, Oddish, Wurmple…) é só do dono: a
  // condição sai do progresso do PRÓPRIO jogador, nunca da mesa. O Pokémon é o
  // que o SERVIDOR marcou como pendente (`pokemonId`), não o ativo do store
  // local — que pode estar defasado se o ativo mudou em outra aba.
  const pendingId = myPlayer?.progress?.pendingChoice ? myPlayer.progress.pokemonId : null;
  const pendingPokemon = pendingId
    ? (trainerPokemon.find((p) => p.id === pendingId) ?? null)
    : null;

  // Pendente que a coleção local ainda não conhece: recarrega UMA vez por id,
  // senão o seletor nunca apareceria até um F5.
  const reloadedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingId || pendingPokemon || trainerStatus !== 'ready') return;
    if (reloadedForRef.current === pendingId) return;
    reloadedForRef.current = pendingId;
    void reloadTrainer();
  }, [pendingId, pendingPokemon, trainerStatus, reloadTrainer]);

  // O servidor manda o estado ja na perspectiva de quem recebe: cada jogador ve
  // o proprio voto sem mascara. Por isso nao existe mais estado local otimista
  // -- a carta destacada e sempre a que o servidor registrou de fato.
  const myVote = (myPlayer?.vote ?? null) as CardValue | null;

  // O papel verdadeiro é o que o servidor devolve no estado: o re-join ignora o
  // `role` do payload (Room.ts), então o store local pode estar defasado.
  const myRole: PlayerRole = myPlayer?.role ?? 'voter';
  const isSpectator = myRole === 'spectator';

  const handleToggleRole = () => {
    if (revealed) return;
    const next: PlayerRole = isSpectator ? 'voter' : 'spectator';
    const hadVote = myPlayer?.vote != null;
    setRole(next);
    setMyRole(next);
    writePreferredRole(next);
    if (userId && myName) writeSession(userId, roomId, { name: myName, role: next });
    toast.info(
      next === 'spectator'
        ? hadVote
          ? 'Você está só assistindo. Seu voto desta rodada foi descartado.'
          : 'Você está só assistindo.'
        : 'Você voltou a votar.',
    );
  };

  const deckDisabled = !joined || revealed || isSpectator;

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
          ou a sala foi excluída pelo dono. Confira o link com quem te convidou.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  if (metaState === 'loading' && !joined) {
    return <FullScreenLoader label="Abrindo a sala…" />;
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
        onClearInactive={handleClearInactive}
        onLeave={handleLeave}
        onHome={() => navigate('/')}
        onToggleFavorite={handleToggleFavorite}
        onToggleRole={handleToggleRole}
        hasInactive={hasInactive}
        isFavorite={isFavorite}
        role={myRole}
        roleLocked={revealed}
      />

      {/* Barra superior: identidade da sala | controle da rodada | conta.
          Grid 1fr-auto-1fr mantém o botão centrado sem sobrepor nada. */}
      <header className="fixed top-0 left-14 right-0 z-20 h-20 px-4 sm:px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 animate-fade-in">
        <div className="min-w-0 hidden sm:block">
          <div className="text-sm font-medium text-text truncate">
            {roomState?.name ?? prefetchedName ?? 'Sala'}
          </div>
          <button
            onClick={handleCopyLink}
            className="group mt-0.5 inline-flex items-center gap-1.5 text-xs font-mono tracking-wider text-subtle hover:text-text transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/70"
            title="Copiar link da sala"
          >
            {roomId}
            <Copy size={11} className="opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <div className="col-start-2">
          {roomState && (
            <RoundControl
              players={players}
              revealed={revealed}
              canReveal={canReveal}
              onReveal={reveal}
              onReset={reset}
            />
          )}
        </div>

        <div className="col-start-3 flex justify-end">
          <TopActions me={myPlayer} onSignOut={handleSignOut} />
        </div>
      </header>

      {/* Acima do Confetti (z-40) e do Dialog (z-50): ver EvolutionOverlay. */}
      <EvolutionOverlay />

      {pendingPokemon && <BranchChoiceDialog pokemon={pendingPokemon} />}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        roomName={roomState?.name ?? roomId}
        playerCount={players.length}
        sequence={sequence}
        isOwner={roomState?.isOwner ?? false}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      {!connected && (
        <div
          role="status"
          className="fixed top-20 left-14 right-0 z-30 flex justify-center pointer-events-none animate-fade-in"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-soft border border-danger/30 text-danger text-xs rounded-full backdrop-blur">
            <PokeballIcon spinning size={11} />
            Conexão perdida. Reconectando…
          </div>
        </div>
      )}

      <main className="pl-14 pt-20 min-h-screen flex flex-col">
        {!roomState ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <PokeballIcon spinning size={28} className="text-muted/60" />
            <span className="text-xs text-subtle">Abrindo a mesa…</span>
          </div>
        ) : (
          <>
            {/* Center area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-10">
              <PokerTable
                players={players}
                revealed={revealed}
                myPlayerId={myPlayerId}
                consensus={stats.consensus}
                outlierIds={stats.outlierIds}
                gainByPlayerId={gainByPlayerId}
                onCeremonyBusyChange={setCeremonyBusy}
                onCopyLink={handleCopyLink}
              />

              <StatsPanel stats={stats} visible={revealed} />
            </div>

            {/* Bottom deck */}
            <div className="pb-10 pt-4">
              {isSpectator ? (
                <div className="flex justify-center animate-fade-up">
                  <div className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full bg-surface-2/80 border border-border text-sm text-muted">
                    <Eye size={15} className="text-subtle" />
                    Você está só assistindo
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      onClick={handleToggleRole}
                      disabled={revealed}
                    >
                      Entrar na votação
                    </Button>
                  </div>
                </div>
              ) : (
                <CardDeck
                  sequence={sequence}
                  selected={myVote}
                  disabled={deckDisabled}
                  onSelect={castVote}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
