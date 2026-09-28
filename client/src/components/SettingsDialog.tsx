import { FormEvent, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { normalizeRoomName, ROOM_NAME_MAX_LENGTH } from '../types';
import type { CardValue } from '../types';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  playerCount: number;
  sequence: CardValue[];
  isOwner: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function SettingsDialog({
  open,
  onClose,
  roomId,
  roomName,
  playerCount,
  sequence,
  isOwner,
  onRename,
  onDelete,
}: SettingsDialogProps) {
  const [name, setName] = useState(roomName);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reabrir o dialog (ou o dono renomear noutra aba) precisa ressincronizar o
  // input; senão ele mostraria um rascunho velho.
  useEffect(() => {
    if (open) {
      setName(roomName);
      setConfirming(false);
      setError(null);
    }
  }, [open, roomName]);

  const cleaned = normalizeRoomName(name);
  const dirty = cleaned.length > 0 && cleaned !== roomName;

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onRename(cleaned);
    } catch {
      setError('Não foi possível salvar o nome.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError('Não foi possível excluir a sala.');
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} dismissable className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text">Configurações da sala</h2>
            <p className="text-xs text-subtle mt-1">Nome, link e cartas desta sala.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 -mr-2 -mt-2 rounded-md text-muted hover:text-text hover:bg-surface-2 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {isOwner ? (
            <form onSubmit={handleRename} className="flex flex-col gap-2">
              <label htmlFor="room-name" className="text-xs uppercase tracking-wider text-subtle">
                Nome da sala
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="room-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={ROOM_NAME_MAX_LENGTH}
                  className="flex-1 bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-highlight/60 focus:ring-2 focus:ring-highlight/15 focus:bg-surface-3 transition-colors"
                />
                <Button type="submit" variant="secondary" disabled={!dirty || saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </form>
          ) : (
            <Row label="Nome" value={roomName} />
          )}

          <Row label="ID da sala" value={<span className="font-mono">{roomId}</span>} />
          <Row label="Jogadores" value={`${playerCount}`} />
          <Row label="Cartas" value={<span className="font-mono">{sequence.join(' · ')}</span>} />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger animate-fade-in">
            {error}
          </div>
        )}

        {isOwner && (
          <div className="mt-6 pt-5 border-t border-border">
            <div className="text-[11px] uppercase tracking-[0.18em] text-subtle mb-3">
              Zona de perigo
            </div>
            {confirming ? (
              <div className="flex flex-col gap-3 animate-fade-in">
                <p className="text-xs text-muted leading-relaxed">
                  Excluir a sala remove o link para sempre e tira todo mundo que
                  estiver jogando agora. Não dá para desfazer.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                    <Trash2 size={14} />
                    {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                <Trash2 size={14} />
                Excluir sala
              </Button>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-subtle leading-relaxed">
          A sala e os favoritos ficam salvos. Os votos da rodada somem quando todo
          mundo sai.
        </p>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
      <span className="text-xs uppercase tracking-wider text-subtle">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}
