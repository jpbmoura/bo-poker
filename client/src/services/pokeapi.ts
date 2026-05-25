import type { Pokemon } from '../types';

const MAX_ID = 386; // Kanto + Johto + Hoenn (Gen 1-3)
const STORAGE_KEY = 'bo-poker:pokemon-cache';
const INDEX_STORAGE_KEY = 'bo-poker:pokemon-index';

export interface PokemonIndexEntry {
  id: number;
  name: string;
}

const memCache = new Map<number, Pokemon>();
let memIndex: PokemonIndexEntry[] | null = null;
let indexPromise: Promise<PokemonIndexEntry[]> | null = null;

function loadDiskCache(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Pokemon>;
    for (const [k, v] of Object.entries(parsed)) {
      memCache.set(Number(k), v);
    }
  } catch {
    // ignore corrupted cache
  }
}

function persistDiskCache(): void {
  try {
    const obj: Record<number, Pokemon> = {};
    for (const [k, v] of memCache) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

let cacheLoaded = false;
function ensureCacheLoaded(): void {
  if (cacheLoaded) return;
  loadDiskCache();
  cacheLoaded = true;
}

function loadIndexFromDisk(): PokemonIndexEntry[] | null {
  try {
    const raw = localStorage.getItem(INDEX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PokemonIndexEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistIndex(index: PokemonIndexEntry[]): void {
  try {
    localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(index));
  } catch {
    // ignore quota errors
  }
}

export async function fetchPokemonIndex(): Promise<PokemonIndexEntry[]> {
  if (memIndex) return memIndex;
  const fromDisk = loadIndexFromDisk();
  if (fromDisk && fromDisk.length >= MAX_ID) {
    memIndex = fromDisk;
    return memIndex;
  }
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${MAX_ID}&offset=0`);
    if (!res.ok) throw new Error(`PokéAPI index error: ${res.status}`);
    const data = await res.json();
    const results = (data.results ?? []) as Array<{ name: string; url: string }>;
    const index: PokemonIndexEntry[] = results.map((r, i) => ({
      id: i + 1,
      name: r.name,
    }));
    memIndex = index;
    persistIndex(index);
    return index;
  })();

  try {
    return await indexPromise;
  } finally {
    indexPromise = null;
  }
}

export async function fetchPokemon(id: number): Promise<Pokemon> {
  ensureCacheLoaded();
  const cached = memCache.get(id);
  if (cached) return cached;

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`PokéAPI error: ${res.status}`);
  const data = await res.json();
  const pokemon: Pokemon = {
    id: data.id,
    name: data.name,
    sprite:
      data.sprites?.front_default ??
      data.sprites?.other?.['official-artwork']?.front_default ??
      '',
  };
  memCache.set(id, pokemon);
  persistDiskCache();
  return pokemon;
}

function sampleUnique(min: number, max: number, n: number): number[] {
  const set = new Set<number>();
  const span = max - min + 1;
  const target = Math.min(n, span);
  while (set.size < target) {
    set.add(Math.floor(Math.random() * span) + min);
  }
  return Array.from(set);
}

export async function fetchRandomPokemons(count = 8): Promise<Pokemon[]> {
  const ids = sampleUnique(1, MAX_ID, count);
  const results = await Promise.all(
    ids.map((id) =>
      fetchPokemon(id).catch(() => null),
    ),
  );
  return results.filter((p): p is Pokemon => p !== null);
}

export function pickRandomId(): number {
  return Math.floor(Math.random() * MAX_ID) + 1;
}

export { MAX_ID };
