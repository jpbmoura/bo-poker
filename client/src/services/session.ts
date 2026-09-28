import type { PlayerRole } from '../types';

/**
 * Preferências de entrada por USUÁRIO e por SALA, guardadas na aba.
 *
 * Não é identidade — quem é o jogador vem da sessão autenticada. Isto só
 * lembra nome e papel para o F5 voltar direto à mesa em vez de reabrir o
 * diálogo. O Pokémon saiu daqui: agora é progressão de CONTA, resolvida pelo
 * servidor, e não uma escolha por sala.
 */
export interface RoomSession {
  name: string;
  role: PlayerRole;
}

const PREFIX = 'bo-poker:session:';

/**
 * Firefox com storage desabilitado e iframes sandboxed lançam ao *acessar*
 * `sessionStorage`, não só ao escrever — por isso o try/catch cobre a leitura
 * também, e existe um fallback em memória para a sessão continuar valendo
 * dentro da aba mesmo quando o storage é inacessível.
 */
const memFallback = new Map<string, RoomSession>();

/**
 * A chave inclui o usuário: sem isso, trocar de conta na mesma aba faria o
 * reingresso automático entrar com o nome e o pokémon da conta anterior.
 */
const keyFor = (userId: string, roomId: string) => `${PREFIX}${userId}:${roomId}`;

export function readSession(userId: string, roomId: string): RoomSession | null {
  const key = keyFor(userId, roomId);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as RoomSession;
  } catch {
    // storage inacessível ou conteúdo corrompido
  }
  return memFallback.get(key) ?? null;
}

export function writeSession(userId: string, roomId: string, session: RoomSession): void {
  const key = keyFor(userId, roomId);
  memFallback.set(key, session);
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // sem persistência: degrada para "F5 = jogador novo", sem quebrar
  }
}

export function clearSession(userId: string, roomId: string): void {
  const key = keyFor(userId, roomId);
  memFallback.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // nada a fazer
  }
}

/**
 * Último papel escolhido no diálogo de entrada, por navegador. Quem sempre
 * entra só para assistir (PO, gestor) não precisa trocar toda vez.
 */
const ROLE_PREF_KEY = 'bo-poker:preferred-role';

export function readPreferredRole(): PlayerRole {
  try {
    return localStorage.getItem(ROLE_PREF_KEY) === 'spectator' ? 'spectator' : 'voter';
  } catch {
    return 'voter';
  }
}

export function writePreferredRole(role: PlayerRole): void {
  try {
    localStorage.setItem(ROLE_PREF_KEY, role);
  } catch {
    // sem persistência: volta ao padrão "voter" na próxima vez
  }
}
