import type { PokemonRecord } from './trainerStore.js';

/** Um Pokémon possuído, em memória. */
export interface PokemonState {
  id: string;
  lineId: string;
  branchId: number | null;
  xp: number;
  isActive: boolean;
  /**
   * Delta de XP ainda não gravado. É um DELTA e não um total: o `addXp` do store
   * incrementa no SQL, então XP creditado durante um flush em voo não se perde.
   */
  pendingXp: number;
}

/** A COLEÇÃO do usuário. Hoje sempre com 0 ou 1 item. */
export interface TrainerState {
  userId: string;
  pokemon: PokemonState[];
}

interface Entry {
  state: TrainerState;
  /**
   * false = a leitura no banco falhou e este estado é DEGRADADO (coleção vazia),
   * não a verdade. Fica no cache mesmo assim, para o `peek` do join ser rápido e
   * para o passe de reconciliação saber quem tentar de novo.
   */
  resolved: boolean;
}

/** Só o que o cache usa do store — é o que torna a classe testável sem banco. */
export interface TrainerStorePort {
  listByUser(userId: string): Promise<PokemonRecord[]>;
  addXp(id: string, delta: number): Promise<void>;
}

function toState(row: PokemonRecord): PokemonState {
  return {
    id: row.id,
    lineId: row.lineId,
    branchId: row.branchId,
    xp: row.xp,
    isActive: row.isActive,
    pendingXp: 0,
  };
}

export class TrainerCacheImpl {
  /**
   * Não expira. São dezenas de usuários e objetos minúsculos; um restart limpa
   * tudo. Enquanto o processo vive, a MEMÓRIA é a fonte da verdade — uma leitura
   * atrasada nunca pode sobrescrever XP ganho desde então.
   */
  private cache = new Map<string, Entry>();

  constructor(private readonly store: TrainerStorePort) {}

  /** Só memória. Nunca toca o banco. */
  peek(userId: string): TrainerState | null {
    return this.cache.get(userId)?.state ?? null;
  }

  /**
   * NUNCA lança. Falha de leitura devolve a coleção vazia marcada como não
   * resolvida, em vez de recusar o join — recusar quebraria a invariante de que
   * uma oscilação do Postgres não impede reconexão nem F5.
   */
  async resolve(userId: string): Promise<TrainerState> {
    const existing = this.cache.get(userId);
    if (existing?.resolved) return existing.state;

    try {
      const rows = await this.store.listByUser(userId);
      const state: TrainerState = { userId, pokemon: rows.map(toState) };
      this.cache.set(userId, { state, resolved: true });
      return state;
    } catch (err) {
      console.error(
        `[trainerCache] leitura degradada de ${userId}:`,
        (err as Error).message,
      );
      if (existing) return existing.state;
      const state: TrainerState = { userId, pokemon: [] };
      this.cache.set(userId, { state, resolved: false });
      return state;
    }
  }

  /** O Pokémon que aparece na mesa. Null quando a coleção está vazia. */
  activePokemon(state: TrainerState): PokemonState | null {
    return state.pokemon.find((p) => p.isActive) ?? state.pokemon[0] ?? null;
  }

  /**
   * Credita XP no ATIVO (ou em `pokemonId`, quando vem — a batalha da captura
   * paga quem lutou) e devolve cópias de antes/depois, para o caller comparar
   * estágios e detectar evolução. Null quando não há Pokémon a avançar — que é
   * o caso de quem nunca escolheu, o da leitura degradada e o de um `pokemonId`
   * que não está mais na coleção.
   */
  applyXp(
    userId: string,
    delta: number,
    pokemonId?: string,
  ): { before: PokemonState; after: PokemonState } | null {
    const state = this.peek(userId);
    if (!state || delta === 0) return null;
    const target =
      pokemonId === undefined
        ? this.activePokemon(state)
        : (state.pokemon.find((p) => p.id === pokemonId) ?? null);
    if (!target) return null;

    const before = { ...target };
    target.xp += delta;
    target.pendingXp += delta;
    return { before, after: { ...target } };
  }

  /** Reflete no cache um registro que o banco JÁ confirmou (create/branch/active). */
  put(userId: string, row: PokemonRecord): PokemonState {
    const state = this.peek(userId) ?? this.seed(userId);
    const next = toState(row);
    const index = state.pokemon.findIndex((p) => p.id === row.id);
    if (index === -1) {
      state.pokemon.push(next);
    } else {
      // Preserva o pendingXp: o flush ainda não rodou e o delta não pode sumir.
      next.pendingXp = state.pokemon[index].pendingXp;
      // E o XP da MEMÓRIA, não o da linha: o banco ainda não tem o delta
      // pendente. Sem isto um Eevee que cruzou o limiar e escolhe a pedra antes
      // do flush voltaria ao estágio 0 — com a pedra gravada e sem evoluir.
      next.xp = state.pokemon[index].xp;
      state.pokemon[index] = next;
    }
    if (next.isActive) {
      for (const p of state.pokemon) {
        if (p.id !== next.id) p.isActive = false;
      }
    }
    return next;
  }

  /** Reflete uma liberação já confirmada no banco. Promove outro a ativo. */
  drop(userId: string, pokemonId: string): void {
    const state = this.peek(userId);
    if (!state) return;
    const wasActive = state.pokemon.find((p) => p.id === pokemonId)?.isActive ?? false;
    state.pokemon = state.pokemon.filter((p) => p.id !== pokemonId);
    if (wasActive && state.pokemon.length > 0) state.pokemon[0].isActive = true;
  }

  forget(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Grava o XP pendente. Chamado pelo sweep que já roda a cada 10 s — falha
   * mantém o delta e tenta de novo no ciclo seguinte.
   */
  async flush(): Promise<number> {
    let written = 0;
    for (const entry of this.cache.values()) {
      for (const p of entry.state.pokemon) {
        if (p.pendingXp === 0) continue;
        const delta = p.pendingXp;
        try {
          await this.store.addXp(p.id, delta);
          // Subtrai o que foi enviado em vez de zerar: XP creditado enquanto o
          // await estava em voo sobrevive ao flush.
          p.pendingXp -= delta;
          written++;
        } catch (err) {
          console.error(
            `[trainerCache] falha ao gravar XP de ${p.id}:`,
            (err as Error).message,
          );
        }
      }
    }
    return written;
  }

  /**
   * Tenta re-resolver quem ficou degradado. Devolve os userIds que voltaram ao
   * normal, para o caller rebroadcastar as salas deles — sem isto a pessoa
   * ficaria de Pokébola até a próxima reconexão.
   */
  async reconcile(): Promise<string[]> {
    const healed: string[] = [];
    for (const [userId, entry] of this.cache) {
      if (entry.resolved) continue;
      try {
        const rows = await this.store.listByUser(userId);
        // Seguro sobrescrever: sem Pokémon ativo o `applyXp` devolve null, então
        // uma entrada degradada nunca acumula pendingXp.
        entry.state.pokemon = rows.map(toState);
        entry.resolved = true;
        healed.push(userId);
      } catch {
        // Segue degradado; o próximo ciclo tenta de novo.
      }
    }
    return healed;
  }

  private seed(userId: string): TrainerState {
    const state: TrainerState = { userId, pokemon: [] };
    this.cache.set(userId, { state, resolved: true });
    return state;
  }

  /** Só para os testes: zera tudo entre casos. */
  clear(): void {
    this.cache.clear();
  }
}
