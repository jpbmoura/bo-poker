import type { Pokemon } from '../types/index.js';

export const TAUROS: Pokemon = {
  id: 128,
  name: 'tauros',
  sprite:
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/128.png',
};

// IMPORTANT: keep this logic in sync with client/src/utils/forcedPokemon.ts.

const LEET_MAP: Record<string, string> = {
  '4': 'a',
  '@': 'a',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '5': 's',
  '7': 't',
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[4@01357]/g, (c) => LEET_MAP[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

const ARTHUR_PATTERN = /arth?ur/;

export function matchesArthur(name: string): boolean {
  return ARTHUR_PATTERN.test(normalize(name));
}

export function getForcedPokemon(name: string): Pokemon | null {
  return matchesArthur(name) ? TAUROS : null;
}
