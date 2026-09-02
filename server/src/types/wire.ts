// SYNC: este arquivo DEVE ser byte-idêntico em client/src/types/wire.ts e
// server/src/types/wire.ts. Garantido por server/src/types/wire.test.ts.
// Mantenha-o SEM imports para que a exigência de extensão .js do servidor
// nunca se aplique e a comparação literal continue válida.

export type CardValue = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?';

export const CARD_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

export type PlayerRole = 'voter' | 'spectator';

export interface Pokemon {
  id: number;
  name: string;
  sprite: string;
}

/**
 * Um jogador na perspectiva de UM espectador específico: `vote` vem sem máscara
 * para esse espectador e como 'HIDDEN' para os demais até o reveal.
 */
export interface SerializedPlayer {
  id: string;
  name: string;
  /** Handle do GitHub. Vem SEMPRE da sessão, nunca do payload do cliente. */
  login: string | null;
  pokemon: Pokemon;
  role: PlayerRole;
  online: boolean;
  joinedAt: number;
  vote: CardValue | 'HIDDEN' | null;
}

export interface RoomState {
  id: string;
  createdAt: number;
  revealed: boolean;
  cardSequence: CardValue[];
  players: SerializedPlayer[];
  topic?: string;
}

export type RoomErrorCode =
  | 'ROOM_FULL'
  | 'INVALID_NAME'
  | 'INVALID_POKEMON'
  | 'INVALID_ROOM'
  | 'NOT_IN_ROOM'
  | 'SESSION_EXPIRED';

export interface RoomError {
  code: RoomErrorCode;
  message: string;
}

/**
 * client -> server `room:join`
 *
 * Não carrega identidade: quem é o jogador vem da sessão autenticada do socket.
 * `name` e `pokemon` são cosméticos e validados no servidor.
 */
export interface JoinPayload {
  roomId: string;
  name: string;
  pokemon: Pokemon;
  role: PlayerRole;
}

/** server -> client `room:joined` */
export interface JoinedPayload {
  playerId: string;
  role: PlayerRole;
}

export const ROOM_ID_MAX_LENGTH = 20;
export const PLAYER_NAME_MAX_LENGTH = 32;

/**
 * Canonicaliza o id da sala. Cliente e servidor DEVEM usar esta mesma função,
 * senão `/room/abc` e `/room/ABC` viram salas diferentes.
 */
export function normalizeRoomId(raw: string): string | null {
  const id = (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (id.length < 1 || id.length > ROOM_ID_MAX_LENGTH) return null;
  return id;
}

/** Normaliza o nome de exibição (cosmético; a identidade vem da sessão). */
export function normalizePlayerName(raw: string): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}
