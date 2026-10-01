import { spriteUrl } from '../data/pokedex.js';
import { MAX_TURNS } from './balance.js';
import type { BattleStatus } from './battleStore.js';
import { moveData } from './deck.js';
import type { BattleEvent, BattleState, Fighter } from './engine.js';
import { effectiveness } from './typeChart.js';
import type { Ailment, MoveCategory, MoveEffect, StatKey, TypeName } from './types.js';

/**
 * O que o cliente vê da batalha. Espelho em `client/src/services/battle.ts`.
 *
 * A mão e o deck do SELVAGEM nunca saem daqui — só as contagens. O estado
 * completo (com o RNG) fica no banco; o cliente não tem como prever o próximo
 * sorteio nem a próxima carta do adversário.
 */
export interface MoveView {
  id: number;
  name: string;
  type: TypeName;
  category: MoveCategory;
  power: number;
  accuracy: number;
  priority: number;
  effect: MoveEffect | null;
  /** Multiplicador contra o adversário atual (0, 0.25 … 4). */
  effectiveness: number;
  stab: boolean;
}

export interface CardView {
  uid: string;
  move: MoveView;
}

export interface FighterView {
  dexId: number;
  name: string;
  sprite: string;
  level: number;
  types: TypeName[];
  hp: number;
  maxHp: number;
  ailment: Ailment | null;
  confused: boolean;
  /** Só os estágios diferentes de 0. */
  stages: Partial<Record<StatKey, number>>;
}

export interface BattleDTO {
  status: BattleStatus;
  turn: number;
  maxTurns: number;
  player: FighterView;
  wild: FighterView;
  hand: CardView[];
  deckCount: number;
  discardCount: number;
  wildHandCount: number;
  wildDeckCount: number;
  /** Pontos somados à chance de captura (0 até vencer). */
  bonus: number;
  xpGained: number;
}

export type { BattleEvent };

function fighterView(f: Fighter): FighterView {
  const stages: Partial<Record<StatKey, number>> = {};
  for (const [stat, value] of Object.entries(f.stages) as [StatKey, number][]) {
    if (value !== 0) stages[stat] = value;
  }
  return {
    dexId: f.dexId,
    name: f.name,
    sprite: spriteUrl(f.dexId),
    level: f.level,
    types: f.types,
    hp: f.hp,
    maxHp: f.stats.hp,
    ailment: f.ailment,
    confused: f.confusedTurns > 0,
    stages,
  };
}

export function moveView(moveId: number, user: Fighter, foe: Fighter): MoveView {
  const m = moveData(moveId);
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category,
    power: m.power,
    accuracy: m.accuracy,
    priority: m.priority,
    effect: m.effect ?? null,
    effectiveness: m.category === 'status' ? 1 : effectiveness(m.type, foe.types),
    stab: m.category !== 'status' && user.types.includes(m.type),
  };
}

export function battleDTO(
  state: BattleState,
  record: { status: BattleStatus; bonus: number; xpGained: number },
): BattleDTO {
  const me = state.player.fighter;
  const foe = state.wild.fighter;
  return {
    status: record.status,
    turn: state.turn,
    maxTurns: MAX_TURNS,
    player: fighterView(me),
    wild: fighterView(foe),
    hand: state.player.hand.map((c) => ({ uid: c.uid, move: moveView(c.moveId, me, foe) })),
    deckCount: state.player.deck.length,
    discardCount: state.player.discard.length,
    wildHandCount: state.wild.hand.length,
    wildDeckCount: state.wild.deck.length,
    bonus: record.bonus,
    xpGained: record.xpGained,
  };
}
