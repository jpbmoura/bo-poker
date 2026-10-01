import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { RoomCard } from '../components/RoomCard';
import { signOut, useSession } from '../services/auth';
import { TrainerBadge } from '../components/TrainerBadge';
import { TrainerDialog } from '../components/TrainerDialog';
import { CaptureDrawer } from '../components/capture/CaptureDrawer';
import { CaptureTab } from '../components/capture/CaptureTab';
import { GuessDrawer } from '../components/guess/GuessDrawer';
import { GuessTab } from '../components/guess/GuessTab';
import { SideTabs } from '../components/ui/SideTabs';
import { useCaptureStore } from '../store/useCaptureStore';
import { useGuessStore } from '../store/useGuessStore';
import { useTrainer } from '../hooks/useTrainer';
import { disconnectSocket } from '../services/socket';
import { createRoom, listRooms, type RoomSummary } from '../services/rooms';
import { normalizeRoomId } from '../types';
import { toast } from '../store/useToastStore';
import { cn } from '../utils/cn';

/** Avisos que chegam de outra rota via `location.state` (ver RoomPage). */
const NOTICES: Record<string, string> = {
  ROOM_DELETED: 'Esta sala foi encerrada pelo dono.',
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const { active, pokemon } = useTrainer();
  // Ramo pendente (pedra do Eevee…) fora da mesa: só a coleção mostra a escolha.
  const hasPendingChoice = pokemon.some((p) => p.progress.pendingChoice);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const capture = useCaptureStore((s) => s.capture);
  const loadCapture = useCaptureStore((s) => s.load);
  const [guessOpen, setGuessOpen] = useState(false);
  const guess = useGuessStore((s) => s.guess);
  const loadGuess = useGuessStore((s) => s.load);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // O segundo clique de "sair" expira: deixar armado para sempre surpreenderia.
  useEffect(() => {
    if (!confirmSignOut) return;
    const t = window.setTimeout(() => setConfirmSignOut(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmSignOut]);

  const noticeKey = (location.state as { notice?: string } | null)?.notice;

  // Mostra o aviso como toast e limpa o state da navegação para o F5 não
  // ressuscitá-lo. O store deduplica, então o double-effect do StrictMode é inócuo.
  useEffect(() => {
    if (!noticeKey) return;
    const message = NOTICES[noticeKey];
    if (message) toast.info(message);
    navigate(location.pathname, { replace: true, state: null });
  }, [noticeKey, location.pathname, navigate]);

  const refresh = useCallback(async () => {
    try {
      const list = await listRooms();
      setRooms(list);
      setLoadFailed(false);
    } catch {
      // Banco fora do ar não pode virar "você não tem sala nenhuma".
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRooms()
      .then((list) => {
        if (cancelled) return;
        setRooms(list);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // O "N online" é um retrato da memória do servidor. Revalidar ao voltar para
  // a aba mantém o indicador honesto sem inventar um canal de presença.
  // A captura do dia vai junto: voltar para a aba depois da meia-noite já mostra
  // o Pokémon novo.
  useEffect(() => {
    void loadCapture();
    void loadGuess();
    const onFocus = () => {
      void refresh();
      void loadCapture();
      void loadGuess();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, loadCapture, loadGuess]);

  // Fora de uma sala não há assento a liberar, então basta encerrar a sessão.
  const handleSignOut = async () => {
    disconnectSocket();
    await signOut();
    window.location.assign('/login');
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const room = await createRoom();
      navigate(`/room/${room.id}`);
    } catch {
      setCreating(false);
      toast.error('Não foi possível criar a sala. Tente de novo em instantes.');
    }
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    // Canonicaliza aqui tambem para "bo-poker 42" e "BOPOKER42" caírem na
    // mesma sala. `encodeURIComponent` deixa de ser necessario: o id
    // normalizado e sempre [A-Z0-9].
    const id = normalizeRoomId(code);
    if (!id) {
      setCodeError('Código inválido. Use só letras e números.');
      return;
    }
    navigate(`/room/${id}`);
  };

  return (
    <div className="min-h-screen bg-dot-grid flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl w-full mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PokeballIcon size={20} className="text-brand" />
            <span className="text-sm font-semibold tracking-tight text-text">
              BO Poker
            </span>
          </div>

          {session && (
            <div className="flex items-center gap-3 animate-fade-in">
              {/* Mesmo badge do dropdown da sala: a home nao usa o TopActions. */}
              <button
                onClick={() => setTrainerOpen(true)}
                title="Meus Pokémon"
                aria-label="Meus Pokémon"
                className="relative flex w-[150px] sm:w-[190px] px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <TrainerBadge pokemon={active} compact />
                {hasPendingChoice && (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-highlight animate-pulse"
                    title="Um Pokémon está pronto para evoluir"
                  />
                )}
              </button>
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-xs text-muted truncate max-w-[160px]">
                  {session.user.name}
                </div>
                {session.user.login && (
                  <div className="text-[11px] text-subtle font-mono truncate max-w-[160px]">
                    @{session.user.login}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => (confirmSignOut ? void handleSignOut() : setConfirmSignOut(true))}
                  title={confirmSignOut ? 'Clique de novo para sair' : 'Sair da conta'}
                  aria-label={confirmSignOut ? 'Clique de novo para sair' : 'Sair da conta'}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center transition-colors active:scale-90',
                    confirmSignOut
                      ? 'text-danger bg-danger-soft'
                      : 'text-muted hover:text-danger hover:bg-danger-soft',
                  )}
                >
                  <LogOut size={16} />
                </button>
                {confirmSignOut && (
                  <span
                    role="status"
                    className="absolute right-0 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-danger/30 text-xs text-danger whitespace-nowrap shadow-lg animate-fade-in z-30"
                  >
                    Clique de novo para sair
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <TrainerDialog open={trainerOpen} onClose={() => setTrainerOpen(false)} />

      {!captureOpen && !guessOpen && (
        <SideTabs>
          {capture && <CaptureTab capture={capture} onOpen={() => setCaptureOpen(true)} />}
          {guess && <GuessTab guess={guess} onOpen={() => setGuessOpen(true)} />}
        </SideTabs>
      )}
      <CaptureDrawer
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onOpenCollection={() => {
          setCaptureOpen(false);
          setTrainerOpen(true);
        }}
      />
      <GuessDrawer open={guessOpen} onClose={() => setGuessOpen(false)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-text">
              Suas salas
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Salas que você criou ou favoritou.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start gap-2 w-full sm:w-auto">
            <form onSubmit={handleJoin} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setCodeError(null);
                  }}
                  placeholder="CÓDIGO"
                  aria-label="Código da sala"
                  aria-invalid={codeError !== null}
                  aria-describedby={codeError ? 'join-code-error' : undefined}
                  className="flex-1 sm:flex-none sm:w-[130px] min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-subtle outline-none focus:border-highlight/60 focus:ring-2 focus:ring-highlight/15 focus:bg-surface-3 transition-colors uppercase tracking-wider font-mono"
                  maxLength={20}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={code.trim().length === 0}
                >
                  Entrar
                  <ArrowRight size={14} />
                </Button>
              </div>
              {codeError && (
                <span id="join-code-error" role="alert" className="text-xs text-danger animate-fade-in">
                  {codeError}
                </span>
              )}
            </form>

            <span className="hidden sm:block self-center text-xs text-subtle px-1">ou</span>

            <Button variant="solid" onClick={handleCreate} disabled={creating}>
              <Plus size={14} />
              {creating ? 'Criando…' : 'Criar sala'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[104px] rounded-xl bg-surface-2 border border-border animate-pulse"
              />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">Não foi possível carregar suas salas.</p>
            <Button variant="secondary" className="mt-4" onClick={() => void refresh()}>
              Tentar de novo
            </Button>
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState onCreate={handleCreate} creating={creating} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onChanged={() => void refresh()} />
            ))}
          </div>
        )}
      </main>

      <footer className="pb-10 text-center text-[11px] text-subtle font-mono">
        BO Poker · BackOffice
      </footer>
    </div>
  );
}

/** Mantém o visual centralizado que a home tinha antes dos cards. */
function EmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="py-16 flex flex-col items-center animate-fade-in">
      <div className="w-full max-w-sm text-center">
        <h2 className="text-2xl font-semibold text-text tracking-tight mb-2">
          Nenhuma sala ainda
        </h2>
        <p className="text-sm text-muted mb-8">
          Crie uma sala e mande o link para o time estimar junto. Ela fica salva aqui
          para as próximas sessões.
        </p>
        <Button
          variant="solid"
          size="lg"
          className="w-full group"
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? 'Criando…' : 'Criar primeira sala'}
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Button>
      </div>
    </div>
  );
}
