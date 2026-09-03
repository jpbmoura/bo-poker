import {
  EEVEE_LINE_ID,
  findLine,
  maxStage,
  nextThreshold,
  resolveForm,
  spriteUrl,
  stageFor,
} from '../data/pokedex.js';
import type { Pokemon, TrainerProgress } from '../types/index.js';

/**
 * O mínimo que este módulo precisa saber de um Pokémon possuído. O
 * `PokemonState` do cache satisfaz esta forma — declarar o shape aqui em vez de
 * importar o do cache evita um ciclo e deixa as funções puras.
 *
 * Repare que tudo aqui recebe UM Pokémon, nunca um usuário: quem escolhe qual
 * resolver é o caller. É o corte que deixa uma futura tela de coleção reusar
 * estas mesmas funções para renderizar todos.
 */
export interface OwnedPokemon {
  id: string;
  lineId: string;
  branchId: number | null;
  xp: number;
}

/** Estágio derivado do XP acumulado, limitado pelo teto da linha. */
export function liveStage(p: OwnedPokemon): number {
  const line = findLine(p.lineId);
  return line ? stageFor(line, p.xp) : 0;
}

/**
 * Eevee que já cruzou o limiar mas ainda não escolheu a pedra. Enquanto isto for
 * verdade ele PERMANECE Eevee — a evolução dele não acontece sozinha.
 */
export function isPendingChoice(p: OwnedPokemon): boolean {
  return p.lineId === EEVEE_LINE_ID && p.branchId === null && liveStage(p) >= 1;
}

/**
 * A espécie exibida num estágio EXPLÍCITO. O estágio vem de fora porque a mesa
 * mostra uma forma adiada durante o reveal — ver `Player.shownStage`.
 */
export function formAt(
  p: OwnedPokemon,
  stage: number,
  branchId: number | null,
): Pokemon | null {
  const entry = resolveForm(p.lineId, stage, branchId);
  if (!entry) return null;
  return { id: entry.id, name: entry.name, sprite: spriteUrl(entry.id) };
}

/**
 * O progresso que vai para o wire. `stage`/`branchId` são os EXIBIDOS; o `xp` é
 * o vivo, de propósito: a barra passar do limiar durante o reveal é o aviso de
 * que a evolução vem aí.
 */
export function progressAt(
  p: OwnedPokemon,
  shownStage: number,
): TrainerProgress | null {
  const line = findLine(p.lineId);
  if (!line) return null;
  return {
    pokemonId: p.id,
    lineId: p.lineId,
    stage: shownStage,
    maxStage: maxStage(line),
    xp: p.xp,
    nextXp: nextThreshold(line, p.xp),
    pendingChoice: isPendingChoice(p),
  };
}

/**
 * O que a mesa mostra de quem ainda não tem Pokémon — nunca escolheu, ou a
 * leitura do banco falhou e o estado está degradado. O sprite vazio faz o
 * cliente cair na Pokébola, que ele já trata em todos os pontos de render.
 */
export const PLACEHOLDER_POKEMON: Pokemon = { id: 0, name: '', sprite: '' };
