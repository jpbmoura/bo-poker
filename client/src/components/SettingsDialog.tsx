import { X } from 'lucide-react';
import { Dialog } from './ui/Dialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  playerCount: number;
}

export function SettingsDialog({ open, onClose, roomId, playerCount }: SettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} dismissable className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text">Configurações da sala</h2>
            <p className="text-xs text-subtle mt-1">Detalhes e preferências desta sessão.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 -mr-2 -mt-2 rounded-md text-muted hover:text-text hover:bg-surface-2 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Row label="ID da sala" value={<span className="font-mono">{roomId}</span>} />
          <Row label="Jogadores" value={`${playerCount}`} />
          <Row label="Sequência" value="Fibonacci (0–21) + ?" />
        </div>

        <p className="mt-6 text-xs text-subtle leading-relaxed">
          Sem auth, sem persistência. Estado vive em memória enquanto a sala estiver ativa.
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
