import { mutation, request } from './api';
import type { Pokemon } from '../types';
import type { TrainerCollection } from './trainer';

/** Espelho do DTO de `server/src/routes/guess.ts`. */
export type GuessStatus = 'open' | 'correct' | 'wrong';

export interface DailyGuess {
  day: string;
  status: GuessStatus;
  /** Só depois do palpite: antes disso existe apenas a silhueta. */
  answer: Pokemon | null;
  guess: string | null;
  /** XP que cada Pokémon da coleção ganhou. */
  xpGained: number;
  /** XP de um acerto. */
  reward: number;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

export interface GuessResult {
  guess: DailyGuess;
  trainer: TrainerCollection;
  evolutions: { from: Pokemon; to: Pokemon }[];
}

/** O `day` na URL só serve para o cache do navegador trocar de imagem à meia-noite. */
export function silhouetteUrl(day: string): string {
  return `/api/guess/today/silhouette.png?day=${day}`;
}

export function getDailyGuess(): Promise<DailyGuess> {
  return request<DailyGuess>('/api/guess/today');
}

/** O `day` é o que o drawer está mostrando — o servidor recusa se o dia virou. */
export function submitGuess(day: string, guess: string): Promise<GuessResult> {
  return request<GuessResult>('/api/guess/today/guess', mutation('POST', { day, guess }));
}
