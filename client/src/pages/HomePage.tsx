import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { RoomCard } from '../components/RoomCard';
import { signOut, useSession } from '../services/auth';
import { TrainerBadge } from '../components/TrainerBadge';
import { TrainerDialog } from '../components/TrainerDialog';
import { CaptureDrawer } from '../components/capture/CaptureDrawer';
import { CaptureTab } from '../components/capture/CaptureTab';
import { useCaptureStore } from '../store/useCaptureStore';
import { useTrainer } from '../hooks/useTrainer';
import { disconnectSocket } from '../services/socket';
import { createRoom, listRooms, type RoomSummary } from '../services/rooms';
import { normalizeRoomId } from '../types';

/** Avisos que chegam de outra rota via `location.state` (ver RoomPage). */
const NOTICES: Record<string, string> = {
  ROOM_DELETED: 'Esta sala foi encerrada pelo dono.',
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const { active } = useTrainer();
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const capture = useCaptureStore((s) => s.capture);
  const loadCapture = useCaptureStore((s) => s.load);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const noticeKey = (location.state as { notice?: string } | null)?.notice;
  const [notice, setNotice] = useState<string | null>(
    noticeKey ? (NOTICES[noticeKey] ?? null) : null,
  );

  // Limpa o state da navegação para o F5 não ressuscitar o aviso.
  useEffect(() => {
    if (noticeKey) navigate(location.pathname, { replace: true, state: null });
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
    const onFocus = () => {
      void refresh();
      void loadCapture();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, loadCapture]);

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
      setNotice('Não foi possível criar a sala. Tente de novo em instantes.');
    }
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    // Canonicaliza aqui tambem para "bo-poker 42" e "BOPOKER42" caírem na
    // mesma sala. `encodeURIComponent` deixa de ser necessario: o id
    // normalizado e sempre [A-Z0-9].
    const id = normalizeRoomId(code);
    if (!id) return;
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
                className="hidden sm:flex w-[190px] px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <TrainerBadge pokemon={active} compact />
              </button>
              <div className="text-right leading-tight">
                <div className="text-xs text-muted truncate max-w-[160px]">
                  {session.user.name}
                </div>
                {session.user.login && (
                  <div className="text-[11px] text-subtle font-mono truncate max-w-[160px]">
                    @{session.user.login}
                  </div>
                )}
              </div>
              <button
                onClick={handleSignOut}
                title="Sair da conta"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger-soft transition-colors active:scale-90"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <TrainerDialog open={trainerOpen} onClose={() => setTrainerOpen(false)} />

      {capture && !captureOpen && (
        <CaptureTab capture={capture} onOpen={() => setCaptureOpen(true)} />
      )}
      <CaptureDrawer
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onOpenCollection={() => {
          setCaptureOpen(false);
          setTrainerOpen(true);
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        {notice && (
          <div className="mb-6 flex items-start justify-between gap-3 p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger animate-fade-in">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} title="Dispensar">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-text">
              Suas salas
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Salas que você criou ou favoritou.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <form onSubmit={handleJoin} className="flex items-center gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                aria-label="Código da sala"
                className="w-[130px] bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-subtle outline-none focus:border-highlight/60 focus:ring-2 focus:ring-highlight/15 focus:bg-surface-3 transition-colors uppercase tracking-wider font-mono"
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
            </form>

            <Button variant="solid" onClick={handleCreate} disabled={creating}>
              <Plus size={14} />
              {creating ? 'Criando...' : 'Criar sala'}
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
          Estimar em equipe
        </h2>
        <p className="text-sm text-muted mb-8">
          Crie sua primeira sala. Ela fica salva aqui para a próxima vez.
        </p>
        <Button
          variant="solid"
          size="lg"
          className="w-full group"
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? 'Criando...' : 'Criar nova sala'}
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Button>
      </div>
    </div>
  );
}
