import { FormEvent, useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { PokemonGrid } from './PokemonGrid';
import { PokeballIcon } from './ui/PokeballIcon';
import type { Pokemon, PlayerRole, RoomError } from '../types';

interface EntryDialogProps {
  open: boolean;
  roomId: string;
  joining: boolean;
  error: RoomError | null;
  onSubmit: (data: { name: string; pokemon: Pokemon; role: PlayerRole }) => void;
}

export function EntryDialog({ open, roomId, joining, error, onSubmit }: EntryDialogProps) {
  const [name, setName] = useState('');
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [spectator, setSpectator] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canSubmit = name.trim().length >= 1 && pokemon !== null && !joining;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !pokemon) return;
    onSubmit({
      name: name.trim(),
      pokemon,
      role: spectator ? 'spectator' : 'voter',
    });
  };

  return (
    <Dialog open={open}>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <PokeballIcon size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-text">Entrar na sala</h2>
        </div>
        <p className="text-xs text-subtle mb-5">
          Sala: <span className="font-mono text-muted">{roomId}</span>
        </p>

        <label className="block text-sm text-muted mb-2">Seu nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como aparecerá na mesa"
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-2.5 text-text placeholder:text-subtle outline-none focus:border-accent/60 transition-colors mb-5"
          maxLength={20}
          autoFocus
        />

        <div className="flex items-center justify-between mb-3">
          <label className="text-sm text-muted">Escolha seu Pokémon</label>
          <button
            type="button"
            onClick={() => {
              setPokemon(null);
              setRefreshKey((k) => k + 1);
            }}
            className="text-xs text-muted hover:text-text transition-colors flex items-center gap-1"
          >
            🎲 Sortear outros
          </button>
        </div>

        <PokemonGrid
          selectedId={pokemon?.id ?? null}
          onSelect={setPokemon}
          refreshKey={refreshKey}
        />

        <label className="flex items-center gap-2 mt-5 text-sm text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={spectator}
            onChange={(e) => setSpectator(e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          Entrar como espectador (não vota)
        </label>

        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
            {error.message}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full mt-6"
          disabled={!canSubmit}
        >
          {joining ? 'Entrando...' : 'Entrar na sala'}
        </Button>
      </form>
    </Dialog>
  );
}
