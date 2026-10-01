import { wildSpecies, type WildSpecies } from '../data/pokedex.js';
import { seeded } from '../capture/dailySpawn.js';

/** XP que CADA Pokémon da coleção ganha quando o palpite acerta. */
export const GUESS_XP = 30;

/**
 * O Pokémon do "Quem é esse Pokémon?" do dia — o mesmo para todo mundo. Sorteio
 * uniforme na natureza inteira (sem peso de tier: aqui raridade não importa) e
 * com sal próprio, para não coincidir com a captura.
 */
export function guessFor(day: string, salt = ''): WildSpecies {
  const pool = wildSpecies();
  const [a] = seeded(day, `guess:${salt}`);
  return pool[Math.floor(a * pool.length)];
}
