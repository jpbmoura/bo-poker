import { Button } from './ui/Button';
import type { PlayerRole } from '../types';

interface RoomControlsProps {
  role: PlayerRole;
  onToggleRole: () => void;
  onLeave: () => void;
}

export function RoomControls({ role, onToggleRole, onLeave }: RoomControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <Button variant="secondary" size="sm" onClick={onToggleRole}>
        {role === 'spectator' ? '🎯 Voltar a votar' : '👁 Modo espectador'}
      </Button>
      <Button variant="danger" size="sm" onClick={onLeave}>
        🚪 Sair
      </Button>
    </div>
  );
}
