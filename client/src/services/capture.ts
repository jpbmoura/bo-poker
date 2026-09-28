import { mutation, request } from './api';
import type { Tier } from '../data/pokedex';
import type { Pokemon } from '../types';
import type { TrainerCollection } from './trainer';

/** Espelho do DTO de `server/src/routes/capture.ts`. */
export type CaptureStatus = 'available' | 'caught' | 'fled' | 'owned';

export interface DailyCapture {
  day: string;
  species: Pokemon;
  lineId: string;
  stage: number;
  tier: Tier;
  /** Chance (%) de cada tentativa. */
  chance: number;
  attempts: number;
  maxAttempts: number;
  status: CaptureStatus;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

export interface CaptureAttempt {
  success: boolean;
  capture: DailyCapture;
  trainer: TrainerCollection;
}

export function getDailyCapture(): Promise<DailyCapture> {
  return request<DailyCapture>('/api/capture/today');
}

/** O `day` é o que o drawer está mostrando — o servidor recusa se o dia virou. */
export function throwPokeball(day: string): Promise<CaptureAttempt> {
  return request<CaptureAttempt>('/api/capture/today/attempt', mutation('POST', { day }));
}
