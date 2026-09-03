import { ApiError, mutation, request } from './api';

/**
 * Espelho do DTO declarado em `server/src/routes/rooms.ts`. Fica FORA do
 * `wire.ts` de propósito: aquele arquivo é o contrato do socket e precisa ser
 * byte-idêntico entre os pacotes. Uma divergência de REST quebra a home no
 * primeiro render, em dev, de forma barulhenta — não em silêncio no meio de
 * uma rodada.
 */
export interface RoomSummary {
  id: string;
  name: string;
  isOwner: boolean;
  isFavorite: boolean;
  onlineCount: number;
  createdAt: string;
}

/** Mantido como alias: o `RoomPage` já ramifica em `err instanceof RoomApiError`. */
export { ApiError as RoomApiError };

export function listRooms(): Promise<RoomSummary[]> {
  return request<RoomSummary[]>('/api/rooms');
}

export function getRoom(id: string): Promise<RoomSummary> {
  return request<RoomSummary>(`/api/rooms/${id}`);
}

export function createRoom(name?: string): Promise<RoomSummary> {
  return request<RoomSummary>('/api/rooms', mutation('POST', { name: name ?? '' }));
}

export function renameRoom(id: string, name: string): Promise<RoomSummary> {
  return request<RoomSummary>(`/api/rooms/${id}`, mutation('PATCH', { name }));
}

export function deleteRoom(id: string): Promise<void> {
  return request<void>(`/api/rooms/${id}`, mutation('DELETE'));
}

export function setFavorite(id: string, on: boolean): Promise<void> {
  return request<void>(`/api/rooms/${id}/favorite`, mutation(on ? 'PUT' : 'DELETE'));
}
