import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Link2, MoreHorizontal, Star, Trash2, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { deleteRoom, setFavorite, type RoomSummary } from '../services/rooms';

interface RoomCardProps {
  room: RoomSummary;
  onChanged: () => void;
}

export function RoomCard({ room, onChanged }: RoomCardProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  // Mesmo padrão do TopActions: fechar ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${room.id}`);
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 1500));
    } catch {
      // Clipboard bloqueado (contexto inseguro): sem feedback é melhor que um erro.
    }
  };

  const handleFavorite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setFavorite(room.id, !room.isFavorite);
      onChanged();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteRoom(room.id);
      onChanged();
      setOpen(false);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={cn(
        'group relative bg-surface-2 border border-border rounded-xl p-4',
        'flex flex-col gap-3 transition-colors',
        'hover:bg-surface-3 hover:border-border-strong',
      )}
    >
      {/* Link em overlay em vez de onClick no card: preserva a semântica de
          âncora (clique do meio, abrir em nova aba) e fica ABAIXO do menu no
          empilhamento, então o ⋯ continua clicável. */}
      <Link
        to={`/room/${room.id}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/70"
        aria-label={`Entrar na sala ${room.name}`}
      />

      {room.isOwner && (
        <Crown
          size={13}
          fill="currentColor"
          className="absolute top-3 right-3 text-highlight"
          aria-label="Você é o dono desta sala"
        />
      )}

      <div className="min-w-0 pr-6">
        <div className="text-sm font-medium text-text truncate">{room.name}</div>
        <div className="mt-0.5 text-[11px] font-mono tracking-wider text-subtle">
          {room.id}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between">
        {room.onlineCount > 0 ? (
          <span className="flex items-center gap-1.5 text-[11px] text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {room.onlineCount} online
          </span>
        ) : (
          <span className="text-[11px] text-subtle">vazia</span>
        )}

        {/* z-10 para ficar acima do overlay do Link. */}
        <div className="relative z-10" ref={ref}>
          <button
            onClick={() => {
              setOpen((o) => !o);
              setConfirming(false);
            }}
            title="Opções da sala"
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
              'text-subtle hover:text-text hover:bg-surface-4 active:scale-90',
              open && 'text-text bg-surface-4',
            )}
          >
            <MoreHorizontal size={15} />
          </button>

          {open && (
            <div className="absolute right-0 top-9 w-52 bg-surface border border-border rounded-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] p-1 animate-fade-up">
              <MenuItem onClick={handleCopy}>
                {copied ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <Link2 size={14} />
                )}
                {copied ? 'Link copiado' : 'Copiar link'}
              </MenuItem>

              <MenuItem onClick={handleFavorite} disabled={busy}>
                <Star
                  size={14}
                  fill={room.isFavorite ? 'currentColor' : 'none'}
                  className={cn(room.isFavorite && 'text-highlight')}
                />
                {room.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              </MenuItem>

              {room.isOwner &&
                (confirming ? (
                  <MenuItem onClick={handleDelete} disabled={busy} danger>
                    <Trash2 size={14} />
                    {busy ? 'Excluindo...' : 'Confirmar exclusão'}
                  </MenuItem>
                ) : (
                  <MenuItem onClick={() => setConfirming(true)} danger>
                    <Trash2 size={14} />
                    Excluir sala
                  </MenuItem>
                ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled &&
          (danger
            ? 'text-danger hover:bg-danger-soft'
            : 'text-muted hover:text-text hover:bg-surface-2'),
      )}
    >
      {children}
    </button>
  );
}
