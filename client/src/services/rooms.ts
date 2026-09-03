import { SERVER_URL } from './auth';

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

/** Carrega o status para a UI distinguir "não existe" (404) de "banco fora" (503). */
export class RoomApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'RoomApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // SERVER_URL é vazia em dev (o Vite faz o proxy) e só existe no arranjo de
  // domínios separados. `credentials: 'include'` é obrigatório: a autorização
  // é o cookie de sessão, igual ao `withCredentials` do socket.
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') code = body.error;
    } catch {
      // Resposta sem JSON (proxy, gateway): o status já basta.
    }
    throw new RoomApiError(res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Mutação sempre com JSON: força o preflight que o `cors()` do servidor filtra. */
const mutation = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

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
