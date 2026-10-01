import { mutation, request } from './api';
import type { Tier } from '../data/pokedex';
import type { Pokemon } from '../types';
import type { TrainerCollection } from './trainer';
import type { BattleStatus, TypeName } from './battle';

/** Espelho do DTO de `server/src/routes/capture.ts`. */
export type CaptureStatus = 'available' | 'caught' | 'fled';

export interface DailyCapture {
  day: string;
  species: Pokemon;
  lineId: string;
  stage: number;
  tier: Tier;
  /** Chance (%) do tier, sem o bônus da batalha. */
  baseChance: number;
  /** Chance (%) de cada tentativa, já com o bônus da batalha. */
  chance: number;
  battle: BattleSummary;
  attempts: number;
  maxAttempts: number;
  status: CaptureStatus;
  /** Já tem a linhagem: capturar vira `xp` para esse Pokémon. Null = Pokémon novo. */
  duplicate: { pokemonId: string; name: string; xp: number } | null;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

/** Um Pokémon da coleção visto como lutador contra o selvagem de hoje. */
export interface FighterOption {
  pokemonId: string;
  level: number;
  types: TypeName[];
  wildLevel: number;
  /** Melhor multiplicador dos tipos dele contra o selvagem (2 = vantagem). */
  attack: number;
  /** Melhor multiplicador dos tipos do selvagem contra ele (2 = risco). */
  defense: number;
}

export interface BattleSummary {
  /** `none` = ainda não batalhou hoje. */
  status: 'none' | BattleStatus;
  bonus: number;
  wildTypes: TypeName[];
  fighters: FighterOption[];
}

export interface CaptureAttempt {
  success: boolean;
  capture: DailyCapture;
  trainer: TrainerCollection;
  /** Repetido capturado: XP creditado no Pokémon da linhagem. */
  xpGained?: number;
  evolution?: { from: Pokemon; to: Pokemon } | null;
}

export function getDailyCapture(): Promise<DailyCapture> {
  return request<DailyCapture>('/api/capture/today');
}

/** O `day` é o que o drawer está mostrando — o servidor recusa se o dia virou. */
export function throwPokeball(day: string): Promise<CaptureAttempt> {
  return request<CaptureAttempt>('/api/capture/today/attempt', mutation('POST', { day }));
}
