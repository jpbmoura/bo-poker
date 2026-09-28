import type { Response } from 'express';
import type { Server } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
import { Events } from '../socket/events.js';
import { broadcastRoomState } from '../socket/handlers.js';
import { TrainerCache } from '../trainers/index.js';
import type { PokemonState } from '../trainers/trainerCache.js';
import { formAt, liveStage, progressAt } from '../trainers/species.js';
import type { EvolutionEvent, Pokemon, TrainerProgress } from '../types/index.js';

/**
 * O que o cliente consome. NÃO vive no `wire.ts`: aquele arquivo é o contrato do
 * socket e precisa continuar byte-idêntico entre os pacotes. Este DTO é HTTP e o
 * espelho dele está em `client/src/services/trainer.ts`.
 *
 * Compartilhado entre `/api/trainer` e `/api/capture`: uma captura bem-sucedida
 * devolve a coleção nova no mesmo formato, e o cliente aplica sem outro GET.
 */
export interface TrainerPokemonDTO {
  id: string;
  isActive: boolean;
  /** Espécie exibida FORA da mesa: aqui não há adiamento de cerimônia. */
  form: Pokemon;
  progress: TrainerProgress;
}

export interface TrainerDTO {
  pokemon: TrainerPokemonDTO[];
  activeId: string | null;
  /** Null = sem limite. */
  maxPokemon: number | null;
}

function toDTO(p: PokemonState): TrainerPokemonDTO | null {
  const stage = liveStage(p);
  const form = formAt(p, stage, p.branchId);
  const progress = progressAt(p, stage);
  if (!form || !progress) return null;
  return { id: p.id, isActive: p.isActive, form, progress };
}

export function trainerDTO(userId: string): TrainerDTO {
  const state = TrainerCache.peek(userId);
  const pokemon = (state?.pokemon ?? [])
    .map(toDTO)
    .filter((p): p is TrainerPokemonDTO => p !== null);
  return {
    pokemon,
    activeId: pokemon.find((p) => p.isActive)?.id ?? null,
    maxPokemon: null,
  };
}

export function respondTrainer(res: Response, userId: string): void {
  res.json(trainerDTO(userId));
}

/**
 * Reflete na mesa uma mudança de conta. Sem adiamento: a pessoa acabou de
 * clicar, não há animação a preservar.
 *
 * Repare que NINGUÉM é expulso da sala quando a coleção esvazia. O servidor
 * falha macio: sem Pokémon o jogador segue sentado, aparece com a Pokébola e
 * ganha 0 XP até escolher outro inicial — que o portão do cliente pede na hora.
 */
export function refreshTrainerRooms(
  io: Server,
  userId: string,
  /**
   * Quando a mudança É uma evolução (a escolha de um ramo), a mesa inteira
   * também recebe a animação. Sem isto a evolução ramificada seria a única
   * silenciosa — ela não passa pelo award do reveal.
   */
  evolution?: { from: Pokemon; to: Pokemon },
): void {
  const identityKey = `user:${userId}`;
  const state = TrainerCache.peek(userId);
  const active = state ? TrainerCache.activePokemon(state) : null;
  for (const room of RoomManager.roomsWithIdentity(identityKey)) {
    room.refreshTrainer(identityKey, active);
    broadcastRoomState(io, room);
    if (!evolution) continue;
    const player = room.findByIdentity(identityKey);
    if (!player) continue;
    const payload: EvolutionEvent = {
      playerId: player.id,
      playerName: player.name,
      from: evolution.from,
      to: evolution.to,
      seq: 0,
    };
    io.to(room.id).emit(Events.POKEMON_EVOLVED, payload);
  }
}
