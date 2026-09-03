import { nanoid } from 'nanoid';
import {
  CARD_SEQUENCE,
  type CardValue,
  type Player,
  type PlayerRole,
  type RoomState,
  type SerializedPlayer,
} from '../types/index.js';
import type { PokemonState } from '../trainers/trainerCache.js';
import { PLACEHOLDER_POKEMON, formAt, liveStage, progressAt } from '../trainers/species.js';

export interface UpsertInput {
  /** Identidade autenticada e estável entre reconexões (`user:<id>`). */
  identityKey: string;
  socketId: string;
  /** Id do usuário do Better Auth. Sempre da sessão. */
  userId: string;
  name: string;
  /** Handle do GitHub; sempre da sessão, nunca do payload. */
  login: string | null;
  /** Referência ao Pokémon ativo no cache. Null = ainda não escolheu. */
  trainer: PokemonState | null;
  role: PlayerRole;
  now: number;
}

/** Metadados vindos do Postgres quando a sala é materializada em memória. */
export interface RoomMeta {
  name?: string;
  ownerId?: string | null;
}

export interface UpsertResult {
  player: Player;
  rebound: boolean;
}

export class Room {
  readonly id: string;
  readonly createdAt: number;
  revealed = false;
  topic?: string;
  /** Nome persistido. Cai no id quando a sala é materializada sem metadados. */
  name: string;
  /** Id do usuário dono. Null só no caminho de teste, que não passa `meta`. */
  ownerId: string | null;

  private players = new Map<string, Player>();
  private byIdentity = new Map<string, string>();
  private bySocket = new Map<string, string>();

  constructor(id: string, meta?: RoomMeta) {
    this.id = id;
    this.createdAt = Date.now();
    this.name = meta?.name ?? id;
    this.ownerId = meta?.ownerId ?? null;
  }

  /**
   * Cria o jogador ou RELIGA a entrada existente. Religar preserva o voto e o
   * `joinedAt` — é isso que faz F5 e reconexão não gerarem um assento novo.
   *
   * Com identidade autenticada, uma segunda aba é GARANTIDAMENTE a mesma
   * pessoa, então o religamento nunca é recusado.
   */
  upsertPlayer(input: UpsertInput): UpsertResult {
    const existingId = this.byIdentity.get(input.identityKey);
    const existing = existingId ? this.players.get(existingId) : undefined;

    if (existing) {
      existing.name = input.name;
      existing.login = input.login;
      const hadTrainer = existing.trainer !== null;
      existing.trainer = input.trainer;
      // A forma exibida NÃO é refotografada no religamento: preservar o snapshot
      // é o que mantém a evolução escondida mesmo se a pessoa der F5 no meio do
      // reveal. A exceção é quem ainda não tinha Pokémon — aí não há o que
      // esconder e a forma precisa aparecer.
      if (!hadTrainer && input.trainer) syncShownForm(existing);
      // O papel NÃO é aplicado no religamento: abrir uma segunda aba mandaria
      // o valor do sessionStorage dela e, se fosse 'spectator', APAGARIA o voto
      // em andamento. Papel tem API própria (`player:setRole`).
      existing.online = true;
      existing.lastSeenAt = input.now;
      existing.socketIds.add(input.socketId);
      this.bySocket.set(input.socketId, existing.id);
      return { player: existing, rebound: true };
    }

    const player: Player = {
      id: nanoid(12),
      identityKey: input.identityKey,
      userId: input.userId,
      name: input.name,
      login: input.login,
      trainer: input.trainer,
      shownStage: 0,
      shownBranchId: input.trainer?.branchId ?? null,
      role: input.role,
      vote: null,
      online: true,
      socketIds: new Set([input.socketId]),
      joinedAt: input.now,
      lastSeenAt: input.now,
    };
    syncShownForm(player);
    this.players.set(player.id, player);
    this.byIdentity.set(player.identityKey, player.id);
    this.bySocket.set(input.socketId, player.id);
    return { player, rebound: false };
  }

  /**
   * Desliga um socket. O jogador só vai a offline quando o ÚLTIMO socket dele
   * some — abas duplicadas compartilham o assento sem derrubar uma à outra.
   */
  unbindSocket(socketId: string, now: number): { playerId: string; wentOffline: boolean } | null {
    const playerId = this.bySocket.get(socketId);
    if (!playerId) return null;
    this.bySocket.delete(socketId);
    const player = this.players.get(playerId);
    if (!player) return null;
    player.socketIds.delete(socketId);
    if (player.socketIds.size > 0) return { playerId, wentOffline: false };
    player.online = false;
    player.lastSeenAt = now;
    return { playerId, wentOffline: true };
  }

  removePlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    for (const socketId of player.socketIds) this.bySocket.delete(socketId);
    if (this.byIdentity.get(player.identityKey) === playerId) {
      this.byIdentity.delete(player.identityKey);
    }
    this.players.delete(playerId);
    return true;
  }

  /**
   * Remoção automática dos offline. NÃO remove quem já votou: senão alguém que
   * vota e fecha o notebook faria a média de todo mundo mudar sozinha no meio
   * da rodada. Esses ficam pendentes e são limpos no `reset()`.
   */
  reapOffline(now: number, graceMs: number): string[] {
    const removed: string[] = [];
    for (const player of [...this.players.values()]) {
      if (player.online) continue;
      if (player.vote !== null) continue;
      if (now - player.lastSeenAt < graceMs) continue;
      this.removePlayer(player.id);
      removed.push(player.id);
    }
    return removed;
  }

  /** Limpeza manual. `minOfflineMs` evita chutar quem está reconectando agora. */
  removeInactive(now: number, minOfflineMs: number): string[] {
    const removed: string[] = [];
    for (const player of [...this.players.values()]) {
      if (player.online) continue;
      if (now - player.lastSeenAt < minOfflineMs) continue;
      this.removePlayer(player.id);
      removed.push(player.id);
    }
    return removed;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const playerId = this.bySocket.get(socketId);
    return playerId ? this.players.get(playerId) : undefined;
  }

  allPlayers(): Player[] {
    return [...this.players.values()];
  }

  setVote(playerId: string, value: CardValue): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.revealed) return false;
    if (player.role !== 'voter') return false;
    if (!CARD_SEQUENCE.includes(value)) return false;
    player.vote = value;
    return true;
  }

  reveal(): boolean {
    if (this.revealed) return false;
    this.revealed = true;
    return true;
  }

  reset(): void {
    this.revealed = false;
    for (const player of this.players.values()) {
      player.vote = null;
      // É AQUI que a forma nova aterrissa. Adiar até o reset é o que impede o
      // `room:state` do reveal de entregar a evolução antes da animação.
      syncShownForm(player);
    }
  }

  /**
   * Reaponta o treinador do jogador e atualiza a forma exibida AGORA, sem
   * adiamento. Para as operações de conta (escolher a pedra, liberar, trocar o
   * ativo): a pessoa acabou de clicar, não há cerimônia a preservar.
   *
   * A referência PRECISA ser reatribuída, não só re-sincronizada: `Player.trainer`
   * aponta para um objeto do cache, e liberar o Pokémon só o tira da coleção —
   * o jogador continuaria segurando o objeto órfão e exibindo o Pokémon que já
   * não tem.
   */
  refreshTrainer(identityKey: string, trainer: PokemonState | null): boolean {
    const player = this.findByIdentity(identityKey);
    if (!player) return false;
    player.trainer = trainer;
    syncShownForm(player);
    return true;
  }

  hasIdentity(identityKey: string): boolean {
    return this.byIdentity.has(identityKey);
  }

  findByIdentity(identityKey: string): Player | undefined {
    const playerId = this.byIdentity.get(identityKey);
    return playerId ? this.players.get(playerId) : undefined;
  }

  setRole(playerId: string, role: PlayerRole): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.revealed) return false;
    if (player.role === role) return false;
    player.role = role;
    if (role === 'spectator') {
      player.vote = null;
    }
    return true;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  allOfflineSince(): number | null {
    if (this.players.size === 0) return this.createdAt;
    let lastActivity = 0;
    for (const player of this.players.values()) {
      if (player.online) return null;
      if (player.lastSeenAt > lastActivity) lastActivity = player.lastSeenAt;
    }
    return lastActivity || this.createdAt;
  }

  /**
   * O espectador é o dono da sala? Compara pela `identityKey` do jogador em vez
   * de devolver o `ownerId` cru: o estado vai para TODA a mesa, e o id de
   * usuário de outra pessoa não tem por que circular.
   */
  private isOwnerViewer(viewerId: string | null): boolean {
    if (!this.ownerId || !viewerId) return false;
    const viewer = this.players.get(viewerId);
    return viewer?.identityKey === `user:${this.ownerId}`;
  }

  /**
   * Estado na perspectiva de UM espectador: ele vê o próprio voto sem máscara,
   * o dos outros como 'HIDDEN' até o reveal. É isso que permite ao cliente
   * confiar só no servidor para saber qual carta está selecionada.
   */
  serializeFor(viewerId: string | null): RoomState {
    const players: SerializedPlayer[] = [];
    for (const p of this.players.values()) {
      let vote: SerializedPlayer['vote'];
      if (p.vote === null) {
        vote = null;
      } else if (this.revealed || p.id === viewerId) {
        vote = p.vote;
      } else {
        vote = 'HIDDEN';
      }
      const form = p.trainer
        ? formAt(p.trainer, p.shownStage, p.shownBranchId)
        : null;
      players.push({
        id: p.id,
        name: p.name,
        login: p.login,
        // Sem Pokémon (nunca escolheu, ou leitura degradada) a mesa mostra a
        // Pokébola: o cliente já cai nela quando o sprite é vazio.
        pokemon: form ?? PLACEHOLDER_POKEMON,
        progress: p.trainer ? progressAt(p.trainer, p.shownStage) : null,
        role: p.role,
        online: p.online,
        joinedAt: p.joinedAt,
        vote,
      });
    }

    return {
      id: this.id,
      name: this.name,
      isOwner: this.isOwnerViewer(viewerId),
      createdAt: this.createdAt,
      revealed: this.revealed,
      cardSequence: CARD_SEQUENCE,
      players,
      topic: this.topic,
    };
  }
}

/**
 * Refotografa a forma exibida a partir do estado VIVO do treinador. Isolado numa
 * função para o adiamento ter um lugar só — quem chama decide QUANDO, nunca como.
 */
function syncShownForm(player: Player): void {
  if (!player.trainer) {
    player.shownStage = 0;
    player.shownBranchId = null;
    return;
  }
  player.shownStage = liveStage(player.trainer);
  player.shownBranchId = player.trainer.branchId;
}
