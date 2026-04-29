import { cn } from '../utils/cn';
import type { SerializedPlayer } from '../types';
import { PokeballIcon } from './ui/PokeballIcon';

interface PlayerListProps {
  players: SerializedPlayer[];
  myPlayerId: string | null;
  revealed: boolean;
}

export function PlayerList({ players, myPlayerId, revealed }: PlayerListProps) {
  return (
    <aside className="w-full lg:w-64 bg-surface border border-border rounded-2xl p-4">
      <h3 className="text-xs uppercase tracking-wider text-subtle mb-3">
        Jogadores ({players.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {players.map((p) => {
          const voted = p.vote !== null;
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                p.id === myPlayerId && 'bg-surface-elevated',
                !p.online && 'opacity-50',
              )}
            >
              <div className="w-7 h-7 rounded-full bg-surface-elevated border border-border flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                {p.pokemon.sprite ? (
                  <img
                    src={p.pokemon.sprite}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <PokeballIcon size={14} className="text-muted" />
                )}
              </div>
              <span className="text-sm text-text truncate flex-1">{p.name}</span>
              {p.role === 'spectator' ? (
                <span className="text-[10px] text-subtle">👁</span>
              ) : revealed ? (
                <span className="text-xs font-mono text-muted">
                  {p.vote ?? '—'}
                </span>
              ) : voted ? (
                <span className="w-2 h-2 rounded-full bg-success" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-border-strong" />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
