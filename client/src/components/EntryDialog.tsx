import { FormEvent, useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { PokemonPicker } from './PokemonPicker';
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

  const canSubmit = name.trim().length >= 1 && pokemon !== null && !joining;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !pokemon) return;
    onSubmit({
      name: name.trim(),
      pokemon,
      role: 'voter',
    });
  };

  return (
    <Dialog open={open}>
      <form onSubmit={handleSubmit} className="p-7">
        <div className="flex items-center gap-2 mb-1">
          <PokeballIcon size={16} className="text-brand" />
          <h2 className="text-base font-semibold text-text">Entrar na sala</h2>
        </div>
        <p className="text-xs text-subtle mb-6">
          <span className="font-mono">{roomId}</span>
        </p>

        <label className="block text-xs uppercase tracking-wider text-subtle mb-2">
          Seu nome
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como aparecerá na mesa"
          className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-border-strong focus:bg-surface-3 transition-colors mb-6"
          maxLength={20}
          autoFocus
        />

        <label className="block text-xs uppercase tracking-wider text-subtle mb-3">
          Escolha seu Pokémon
        </label>

        <PokemonPicker selected={pokemon} onSelect={setPokemon} />

        {error && (
          <div className="mt-4 p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger animate-fade-in">
            {error.message}
          </div>
        )}

        <Button
          type="submit"
          variant="solid"
          size="lg"
          className="w-full mt-6 press-down"
          disabled={!canSubmit}
        >
          {joining ? 'Entrando...' : 'Entrar na sala'}
        </Button>
      </form>
    </Dialog>
  );
}
