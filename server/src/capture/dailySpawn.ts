import { createHash } from 'node:crypto';
import { SPAWN_WEIGHT, TIERS, wildSpecies, type Tier, type WildSpecies } from '../data/pokedex.js';

/**
 * O "dia" da captura é a data civil de São Paulo. O Brasil não tem horário de
 * verão desde 2019, então o fuso é fixo em -03:00 — o `Intl` resolve a data e o
 * offset fixo resolve o instante do reset.
 */
export const CAPTURE_TIME_ZONE = 'America/Sao_Paulo';
const UTC_OFFSET = '-03:00';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAPTURE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` do instante, no fuso da captura. */
export function dayKey(now: Date): string {
  return dayFormat.format(now);
}

/** Instante em que o dia de `now` acaba e um novo Pokémon aparece. */
export function nextReset(now: Date): Date {
  const today = new Date(`${dayKey(now)}T00:00:00${UTC_OFFSET}`);
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Dois números em [0, 1) derivados de forma estável da data (+ sal). */
function seeded(day: string, salt: string): [number, number] {
  const digest = createHash('sha256').update(`${salt}:${day}`).digest();
  return [digest.readUInt32BE(0) / 2 ** 32, digest.readUInt32BE(4) / 2 ** 32];
}

function byTier(): Map<Tier, WildSpecies[]> {
  const map = new Map<Tier, WildSpecies[]>();
  for (const species of wildSpecies()) {
    const list = map.get(species.tier) ?? [];
    list.push(species);
    map.set(species.tier, list);
  }
  return map;
}

let tierCache: Map<Tier, WildSpecies[]> | null = null;

/**
 * O Pokémon do dia — o MESMO para todo mundo. Sorteia primeiro o tier (pelo
 * peso) e depois a espécie de forma uniforme dentro dele: assim a frequência de
 * lendários depende do peso, não de quantos lendários existem no catálogo.
 */
export function spawnFor(day: string, salt = ''): WildSpecies {
  tierCache ??= byTier();
  const tiers = TIERS.filter((t) => (tierCache!.get(t)?.length ?? 0) > 0);
  const total = tiers.reduce((sum, t) => sum + SPAWN_WEIGHT[t], 0);

  const [a, b] = seeded(day, salt);
  let roll = a * total;
  let tier = tiers[tiers.length - 1];
  for (const t of tiers) {
    roll -= SPAWN_WEIGHT[t];
    if (roll < 0) {
      tier = t;
      break;
    }
  }
  const pool = tierCache.get(tier)!;
  return pool[Math.floor(b * pool.length)];
}
