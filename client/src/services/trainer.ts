import { mutation, request } from './api';
import type { Pokemon, TrainerProgress } from '../types';

/**
 * Espelho do DTO de `server/src/routes/trainer.ts`. Fora do `wire.ts` pelo mesmo
 * motivo do `RoomSummary`: aquele é o contrato do socket e precisa continuar
 * byte-idêntico entre os pacotes.
 *
 * É uma COLEÇÃO. Hoje `maxPokemon` é 1 e a lista tem no máximo um item, mas
 * nada no caminho assume isso.
 */
export interface TrainerPokemon {
  id: string;
  isActive: boolean;
  form: Pokemon;
  progress: TrainerProgress;
}

export interface TrainerCollection {
  pokemon: TrainerPokemon[];
  activeId: string | null;
  maxPokemon: number;
}

export function getTrainer(): Promise<TrainerCollection> {
  return request<TrainerCollection>('/api/trainer');
}

export function catchPokemon(lineId: string): Promise<TrainerCollection> {
  return request<TrainerCollection>('/api/trainer/pokemon', mutation('POST', { lineId }));
}

export function setActivePokemon(id: string): Promise<TrainerCollection> {
  return request<TrainerCollection>(`/api/trainer/pokemon/${id}/active`, mutation('POST'));
}

export function chooseBranch(id: string, dexId: number): Promise<TrainerCollection> {
  return request<TrainerCollection>(
    `/api/trainer/pokemon/${id}/branch`,
    mutation('POST', { dexId }),
  );
}

/** Liberar. Hoje é o "recomeçar do zero": solta o único e a coleção esvazia. */
export function releasePokemon(id: string): Promise<TrainerCollection> {
  return request<TrainerCollection>(`/api/trainer/pokemon/${id}`, mutation('DELETE'));
}
