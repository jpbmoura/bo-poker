import type { Tier } from '../data/pokedex.js';

/**
 * Todos os números de balanceamento da batalha num lugar só. Ajustados com
 * `pnpm --filter bo-poker-server sim:battle`, que roda milhares de batalhas por
 * tier — mexeu aqui, rode o simulador de novo.
 */

/** Cartas na mão. Jogou uma, compra outra. */
export const HAND_SIZE = 3;

/** Turnos até a batalha acabar em derrota (evita duelo eterno de cura). */
export const MAX_TURNS = 30;

/** Golpes distintos no deck e quantos deles podem ser de status. */
export const DECK_DISTINCT = 6;
export const DECK_MAX_STATUS = 2;
/** Deck mínimo: Pokémon com 1–2 golpes repete cartas até chegar aqui. */
export const DECK_MIN_SIZE = 10;

/**
 * HP da batalha = HP do jogo × isto. Com o HP "de verdade" a luta acaba em 2
 * turnos e nenhuma carta de efeito chega a importar.
 */
export const HP_SCALE = 3;

export const MIN_LEVEL = 20;
export const MAX_LEVEL = 55;
/** XP por nível do Pokémon do jogador: 0 XP = L20, 250 = L32, 650 = L52. */
export const XP_PER_LEVEL = 20;

export function playerLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, MIN_LEVEL + Math.floor(xp / XP_PER_LEVEL)));
}

/**
 * Nível do selvagem = nível do lutador + deslocamento do tier, nunca abaixo do
 * piso do tier. Acompanhar o lutador impede que o Pokémon estágio 3 atropele
 * tudo e que o recém-capturado nunca vença. O deslocamento é NEGATIVO porque a
 * raridade já vem nos base stats (lendário ~600 de BST, Rattata ~250): no mesmo
 * nível, o selvagem raro venceria sempre.
 *
 * Simulado (jogador que sempre joga a melhor carta), vitória comum → lendário:
 * estágio 1 recém-capturado ~85% → ~19%; estágio 3 com 700 XP ~97% → ~42%.
 */
export const WILD_LEVEL_OFFSET: Record<Tier, number> = {
  common: -6,
  uncommon: -5,
  rare: -5,
  epic: -5,
  legendary: -4,
};
export const WILD_LEVEL_FLOOR: Record<Tier, number> = {
  common: 10,
  uncommon: 11,
  rare: 13,
  epic: 14,
  legendary: 16,
};

export function wildLevel(tier: Tier, fighterLevel: number): number {
  return Math.min(MAX_LEVEL + 10, Math.max(WILD_LEVEL_FLOOR[tier], fighterLevel + WILD_LEVEL_OFFSET[tier]));
}

/** XP para o Pokémon que venceu. */
export const BATTLE_XP: Record<Tier, number> = {
  common: 15,
  uncommon: 25,
  rare: 40,
  epic: 60,
  legendary: 100,
};

/** Teto da chance de captura depois do bônus. */
export const MAX_CAPTURE_CHANCE = 95;
export const MIN_BONUS = 20;
export const MAX_BONUS = 50;

/** Pontos somados à chance de captura: +20 numa vitória no limite, +50 sem levar dano. */
export function battleBonus(hpRatio: number): number {
  const r = Math.min(1, Math.max(0, hpRatio));
  return Math.round(MIN_BONUS + (MAX_BONUS - MIN_BONUS) * r);
}

export function captureChance(base: number, bonus: number): number {
  return Math.min(MAX_CAPTURE_CHANCE, base + bonus);
}

/** Chance (0–1) da IA do selvagem jogar a melhor carta em vez de uma aleatória. */
export const AI_GREEDY = 0.7;
