export type CardValue = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?';

export const CARD_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

export type PlayerRole = 'voter' | 'spectator';

export interface Pokemon {
  id: number;
  name: string;
  sprite: string;
}

export interface SerializedPlayer {
  id: string;
  name: string;
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

export type RoomErrorCode = 'NAME_TAKEN' | 'ROOM_FULL' | 'INVALID_NAME' | 'INVALID_POKEMON';

export interface RoomError {
  code: RoomErrorCode;
  message: string;
}
