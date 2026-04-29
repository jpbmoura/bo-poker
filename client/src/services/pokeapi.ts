import type { Pokemon } from '../types';

const KANTO_MAX = 151;
const STORAGE_KEY = 'bo-poker:pokemon-cache';

const memCache = new Map<number, Pokemon>();

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
  while (set.size < n) {
    set.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(set);
}

export async function fetchRandomPokemons(count = 8): Promise<Pokemon[]> {
  const ids = sampleUnique(1, KANTO_MAX, count);
  const results = await Promise.all(
    ids.map((id) =>
      fetchPokemon(id).catch(() => null),
    ),
  );
  return results.filter((p): p is Pokemon => p !== null);
}
