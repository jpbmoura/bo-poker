import type { Pokemon } from '../types';

export const TAUROS: Pokemon = {
  id: 128,
  name: 'tauros',
  sprite:
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/128.png',
};

const FORCED_BY_NAME: Record<string, Pokemon> = {
  arthur: TAUROS,
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function getForcedPokemonForName(name: string): Pokemon | null {
  return FORCED_BY_NAME[normalize(name)] ?? null;
}
