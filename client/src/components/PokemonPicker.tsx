import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Search, X } from 'lucide-react';
import type { Pokemon } from '../types';
import {
  fetchPokemon,
  fetchPokemonIndex,
  fetchRandomPokemons,
  pickRandomId,
  type PokemonIndexEntry,
} from '../services/pokeapi';
import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';

interface PokemonPickerProps {
  selected: Pokemon | null;
  onSelect: (pokemon: Pokemon | null) => void;
  locked?: boolean;
}

const GRID_SIZE = 4;
const ROLL_POOL_SIZE = 12;
const ROLL_INTERVALS_MS = [40, 50, 65, 85, 110, 145, 190, 250, 320];

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function filterIndex(index: PokemonIndexEntry[], rawQuery: string): PokemonIndexEntry[] {
  const q = normalize(rawQuery);
  if (q.length === 0) return [];
  const numeric = /^\d+$/.test(q) ? parseInt(q, 10) : null;
  const starts: PokemonIndexEntry[] = [];
  const contains: PokemonIndexEntry[] = [];
  for (const entry of index) {
    if (numeric !== null && entry.id === numeric) {
      starts.unshift(entry);
      continue;
    }
    const name = entry.name;
    if (name.startsWith(q)) starts.push(entry);
    else if (name.includes(q)) contains.push(entry);
  }
  return [...starts, ...contains].slice(0, GRID_SIZE);
}

export function PokemonPicker({ selected, onSelect, locked = false }: PokemonPickerProps) {
  const [index, setIndex] = useState<PokemonIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [rollPool, setRollPool] = useState<Pokemon[]>([]);
  const [gridItems, setGridItems] = useState<Pokemon[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollSprite, setRollSprite] = useState<Pokemon | null>(null);
  const [slotKey, setSlotKey] = useState(0);
  const [rollTick, setRollTick] = useState(0);
  const rollTimerRef = useRef<number | null>(null);

  // Load index + silent roll pool (powers the slot-machine animation; not shown)
  useEffect(() => {
    let cancelled = false;
    setIndexLoading(true);
    Promise.all([
      fetchPokemonIndex().catch(() => [] as PokemonIndexEntry[]),
      fetchRandomPokemons(ROLL_POOL_SIZE),
    ])
      .then(([idx, randoms]) => {
        if (cancelled) return;
        setIndex(idx);
        setRollPool(randoms);
      })
      .finally(() => {
        if (!cancelled) setIndexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch grid when query changes
  useEffect(() => {
    if (query.trim().length === 0) {
      setGridItems([]);
      setGridLoading(false);
      return;
    }
    if (index.length === 0) return;
    const matches = filterIndex(index, query);
    if (matches.length === 0) {
      setGridItems([]);
      setGridLoading(false);
      return;
    }
    let cancelled = false;
    setGridLoading(true);
    Promise.all(matches.map((m) => fetchPokemon(m.id).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        setGridItems(results.filter((p): p is Pokemon => p !== null));
      })
      .finally(() => {
        if (!cancelled) setGridLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, index]);

  // Cleanup pending roll timer on unmount
  useEffect(() => {
    return () => {
      if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    };
  }, []);

  const handleSelect = useCallback(
    (p: Pokemon) => {
      if (rolling || locked) return;
      onSelect(p);
      setSlotKey((k) => k + 1);
    },
    [rolling, locked, onSelect],
  );

  const handleRoll = useCallback(async () => {
    if (rolling || locked) return;
    setRolling(true);
    const finalId = pickRandomId();
    // Pre-fetch the final pokemon so the landing is instant
    const finalPokemonPromise = fetchPokemon(finalId).catch(() => null);

    // Roll through random sprites with decelerating intervals.
    let step = 0;
    const tick = async () => {
      if (step >= ROLL_INTERVALS_MS.length) {
        const finalPokemon = await finalPokemonPromise;
        if (!finalPokemon) {
          setRolling(false);
          return;
        }
        setRollSprite(null);
        onSelect(finalPokemon);
        setSlotKey((k) => k + 1);
        setRolling(false);
        return;
      }
      // Use cached pokemons from the roll pool for snappy ticks
      const candidate = rollPool[Math.floor(Math.random() * rollPool.length)] ?? null;
      if (candidate) {
        setRollSprite(candidate);
        setRollTick((t) => t + 1);
      } else {
        const fallback = await fetchPokemon(pickRandomId()).catch(() => null);
        if (fallback) {
          setRollSprite(fallback);
          setRollTick((t) => t + 1);
        }
      }
      const delay = ROLL_INTERVALS_MS[step];
      step += 1;
      rollTimerRef.current = window.setTimeout(tick, delay);
    };
    tick();
  }, [rolling, locked, rollPool, onSelect]);

  const slotPokemon = rolling ? rollSprite : selected;
  const hasQuery = query.trim().length > 0;
  const showEmptyState = hasQuery && !gridLoading && gridItems.length === 0;

  const sortedGrid = useMemo(() => gridItems, [gridItems]);

  return (
    <div className={cn('flex flex-col gap-3', locked && 'select-none')}>
      {/* Slot de destaque */}
      <div
        className={cn(
          'relative h-24 rounded-xl bg-surface-2 border overflow-hidden flex items-center gap-4 px-4 transition-colors',
          locked
            ? 'border-highlight/40 shadow-[inset_0_0_24px_-8px_rgba(245,158,11,0.25)]'
            : 'border-border',
        )}
      >
        <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
          {slotPokemon?.sprite ? (
            <img
              key={rolling ? `roll-${rollTick}` : `pick-${slotKey}`}
              src={slotPokemon.sprite}
              alt={slotPokemon.name}
              className={cn(
                'w-full h-full object-contain',
                rolling ? 'animate-slot-roll' : 'animate-slot-land',
              )}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PokeballIcon size={36} className="text-subtle/50" spinning={rolling} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {slotPokemon ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.18em] text-subtle font-mono">
                Nº {String(slotPokemon.id).padStart(3, '0')}
              </div>
              <div className="text-base font-semibold text-text capitalize truncate">
                {slotPokemon.name}
              </div>
              {!rolling && !locked && (
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  className="text-[10px] text-subtle hover:text-text transition-colors mt-0.5 flex items-center gap-1 active:scale-95"
                >
                  <X size={10} /> Limpar
                </button>
              )}
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-[0.18em] text-subtle font-mono">
                Nenhum selecionado
              </div>
              <div className="text-sm text-muted">
                Busque pelo nome ou sorteie um Pokémon.
              </div>
            </>
          )}
        </div>

        {/* Sortear */}
        <button
          type="button"
          onClick={handleRoll}
          disabled={rolling || indexLoading || locked}
          className={cn(
            'relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg',
            'bg-surface-3 border border-border text-muted hover:text-text hover:border-border-strong',
            'transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
            rolling && 'animate-pulse-glow text-text border-border-strong',
          )}
          aria-label="Sortear Pokémon aleatório"
        >
          <Dices
            size={20}
            className={cn(
              'transition-transform duration-300',
              rolling ? 'animate-spin-slow' : 'group-hover:rotate-12',
            )}
          />
          <span className="text-[9px] uppercase tracking-wider font-medium">
            Sortear
          </span>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query.length > 0) {
              e.preventDefault();
              setQuery('');
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (sortedGrid.length > 0) handleSelect(sortedGrid[0]);
            }
          }}
          placeholder={indexLoading ? 'Carregando...' : 'Buscar por nome ou número'}
          disabled={indexLoading || locked}
          className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-9 py-2 text-sm text-text placeholder:text-subtle outline-none focus:border-border-strong focus:bg-surface-3 transition-colors disabled:opacity-50"
          role="searchbox"
          aria-label="Buscar Pokémon"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-text transition-colors p-1 active:scale-90"
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Grid — só aparece quando há busca */}
      {hasQuery && (
        <div className="animate-fade-in">
          {gridLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: GRID_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-surface-2 border border-border animate-pulse flex items-center justify-center"
                >
                  <PokeballIcon size={18} className="text-subtle/40" spinning />
                </div>
              ))}
            </div>
          ) : showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
              <PokeballIcon size={24} className="text-subtle/40" />
              <div className="text-xs text-muted">
                Nenhum Pokémon encontrado para "<span className="text-text">{query}</span>"
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  handleRoll();
                }}
                className="text-xs text-muted hover:text-text transition-colors flex items-center gap-1.5 active:scale-95 px-2.5 py-1.5 rounded-md border border-border hover:border-border-strong"
              >
                <Dices size={13} /> Sortear um para mim
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {sortedGrid.map((p, i) => {
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  disabled={rolling || locked}
                  style={{ animationDelay: `${Math.min(i * 28, 280)}ms` }}
                  className={cn(
                    'aspect-square rounded-lg bg-surface-2 border transition-all duration-150 flex flex-col items-center justify-center p-1.5',
                    'animate-reflow-in',
                    'hover:bg-surface-3 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.4)]',
                    'disabled:cursor-not-allowed disabled:hover:translate-y-0',
                    isSelected
                      ? 'border-text shadow-[0_0_0_1px_var(--text)] bg-surface-3'
                      : 'border-border hover:border-border-strong',
                  )}
                  title={p.name}
                >
                  {p.sprite ? (
                    <img
                      src={p.sprite}
                      alt={p.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <PokeballIcon className="text-subtle" />
                  )}
                  <span
                    className={cn(
                      'text-[10px] capitalize truncate w-full text-center',
                      isSelected ? 'text-text' : 'text-subtle',
                    )}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
