import { useEffect, useState } from 'react';
import type { Pokemon } from '../types';
import { fetchRandomPokemons } from '../services/pokeapi';
import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';

interface PokemonGridProps {
  selectedId: number | null;
  onSelect: (pokemon: Pokemon) => void;
  refreshKey: number;
}

export function PokemonGrid({ selectedId, onSelect, refreshKey }: PokemonGridProps) {
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRandomPokemons(8)
      .then((list) => {
        if (cancelled) return;
        if (list.length < 8) {
          setError('Não foi possível carregar todos os Pokémon. Tente novamente.');
        }
        setPokemons(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar Pokémon.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-surface-elevated animate-pulse flex items-center justify-center"
          >
            <PokeballIcon size={20} className="text-subtle/40" spinning />
          </div>
        ))}
      </div>
    );
  }

  if (error && pokemons.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {pokemons.map((p) => {
        const selected = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              'aspect-square rounded-xl bg-surface-elevated border-2 transition-all duration-150 flex flex-col items-center justify-center p-1 hover:border-border-strong',
              selected
                ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]'
                : 'border-border',
            )}
            title={p.name}
          >
            {p.sprite ? (
              <img
                src={p.sprite}
                alt={p.name}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <PokeballIcon className="text-subtle" />
            )}
            <span className="text-[10px] capitalize text-subtle truncate w-full text-center">
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
