import { AI_GREEDY, HAND_SIZE, HP_SCALE, MAX_TURNS } from './balance.js';
import { buildDeck, moveData, speciesData } from './deck.js';
import * as rng from './rng.js';
import type { Rng } from './rng.js';
import { effectiveness } from './typeChart.js';
import type { Ailment, MoveData, StatKey, TypeName } from './types.js';

/**
 * Motor da batalha de cartas. PURO: recebe um estado, devolve o próximo e a
 * lista de eventos para o cliente animar. Nada de banco nem relógio aqui — o
 * RNG mora dentro do estado, então salvar em jsonb e continuar depois dá
 * exatamente o mesmo resultado.
 */

export type Side = 'player' | 'wild';
export type Outcome = 'active' | 'won' | 'lost';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Fighter {
  dexId: number;
  name: string;
  level: number;
  types: TypeName[];
  stats: Stats;
  hp: number;
  stages: Record<StatKey, number>;
  ailment: Ailment | null;
  /** Turnos que ainda dorme. */
  sleepTurns: number;
  /** Contador do Toxic: dano = n/16, cresce a cada turno. */
  toxicCounter: number;
  /** Turnos de confusão restantes; 0 = não está confuso. */
  confusedTurns: number;
}

export interface Card {
  uid: string;
  moveId: number;
}

export interface SideState {
  fighter: Fighter;
  deck: Card[];
  hand: Card[];
  discard: Card[];
}

export interface BattleState {
  v: 1;
  rng: Rng;
  turn: number;
  outcome: Outcome;
  player: SideState;
  wild: SideState;
}

export type SkipReason = 'sleep' | 'freeze' | 'paralysis';

export type BattleEvent =
  | { kind: 'move'; side: Side; moveId: number; name: string; type: TypeName }
  | { kind: 'miss'; side: Side }
  | { kind: 'fail'; side: Side }
  | {
      kind: 'damage';
      side: Side; // quem LEVOU
      amount: number;
      hp: number;
      effectiveness: number;
      crit: boolean;
    }
  | { kind: 'heal'; side: Side; amount: number; hp: number }
  | { kind: 'ailment'; side: Side; ailment: Ailment }
  | { kind: 'cure'; side: Side; ailment: Ailment }
  | { kind: 'confused'; side: Side }
  | { kind: 'confusionEnd'; side: Side }
  | { kind: 'selfHit'; side: Side; amount: number; hp: number }
  | { kind: 'skip'; side: Side; reason: SkipReason }
  | { kind: 'stat'; side: Side; stat: StatKey; delta: number }
  | { kind: 'residual'; side: Side; ailment: Ailment; amount: number; hp: number }
  | { kind: 'faint'; side: Side }
  | { kind: 'timeout' }
  | { kind: 'end'; outcome: Exclude<Outcome, 'active'> };

export class BattleError extends Error {
  constructor(readonly code: 'BATTLE_OVER' | 'INVALID_CARD') {
    super(code);
  }
}

export interface FighterInput {
  dexId: number;
  name: string;
  level: number;
}

const ZERO_STAGES: Record<StatKey, number> = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

/** Fórmula de stat da Gen 3+ sem IV/EV/natureza, com o HP escalado (HP_SCALE). */
export function computeStats(dexId: number, level: number): Stats {
  const [hp, atk, def, spa, spd, spe] = speciesData(dexId).stats;
  const other = (base: number) => Math.floor((2 * base * level) / 100) + 5;
  return {
    hp: (Math.floor((2 * hp * level) / 100) + level + 10) * HP_SCALE,
    atk: other(atk),
    def: other(def),
    spa: other(spa),
    spd: other(spd),
    spe: other(spe),
  };
}

function makeFighter(input: FighterInput): Fighter {
  const stats = computeStats(input.dexId, input.level);
  return {
    dexId: input.dexId,
    name: input.name,
    level: input.level,
    types: speciesData(input.dexId).types,
    stats,
    hp: stats.hp,
    stages: { ...ZERO_STAGES },
    ailment: null,
    sleepTurns: 0,
    toxicCounter: 0,
    confusedTurns: 0,
  };
}

function makeSide(r: Rng, prefix: string, input: FighterInput): SideState {
  const cards = buildDeck(input.dexId, input.level).map((moveId, i) => ({
    uid: `${prefix}${i}`,
    moveId,
  }));
  const side: SideState = { fighter: makeFighter(input), deck: rng.shuffle(r, cards), hand: [], discard: [] };
  draw(r, side);
  return side;
}

export function createBattle(player: FighterInput, wild: FighterInput, seed: number): BattleState {
  const r: Rng = { state: seed | 0 };
  return {
    v: 1,
    rng: r,
    turn: 1,
    outcome: 'active',
    player: makeSide(r, 'p', player),
    wild: makeSide(r, 'w', wild),
  };
}

/** Completa a mão. Deck vazio embaralha o descarte de volta. */
function draw(r: Rng, side: SideState): void {
  while (side.hand.length < HAND_SIZE) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = rng.shuffle(r, side.discard);
      side.discard = [];
    }
    side.hand.push(side.deck.shift()!);
  }
}

/** Multiplicador de estágio: +1 = ×1.5, -1 = ×0.67… */
function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Escala de precisão/evasão: +1 = ×1.33. */
function accuracyMult(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

function effectiveStat(f: Fighter, stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe'): number {
  let value = f.stats[stat] * stageMult(f.stages[stat]);
  if (stat === 'spe' && f.ailment === 'paralysis') value *= 0.5;
  return value;
}

/** Imunidades de status por tipo (fogo não queima, elétrico não paralisa…). */
function immuneTo(f: Fighter, ailment: Ailment): boolean {
  switch (ailment) {
    case 'burn':
      return f.types.includes('fire');
    case 'paralysis':
      return f.types.includes('electric');
    case 'freeze':
      return f.types.includes('ice');
    case 'poison':
    case 'toxic':
      return f.types.includes('poison') || f.types.includes('steel');
    default:
      return false;
  }
}

function baseDamage(level: number, power: number, attack: number, defense: number): number {
  return Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / defense / 50) + 2;
}

export interface DamageRoll {
  amount: number;
  effectiveness: number;
  crit: boolean;
}

/**
 * Dano da Gen 3+ simplificado: sem item, habilidade nem clima. `roll` em
 * [0.85, 1] e `crit` vêm de fora para a IA estimar com o valor médio.
 */
export function damageOf(
  attacker: Fighter,
  defender: Fighter,
  move: MoveData,
  roll: number,
  crit: boolean,
): DamageRoll {
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0 || move.power === 0) return { amount: 0, effectiveness: eff, crit: false };
  const physical = move.category === 'physical';
  // Crítico ignora os estágios ruins de quem ataca e os bons de quem defende.
  const atkStage = attacker.stages[physical ? 'atk' : 'spa'];
  const defStage = defender.stages[physical ? 'def' : 'spd'];
  const a =
    attacker.stats[physical ? 'atk' : 'spa'] * stageMult(crit ? Math.max(0, atkStage) : atkStage);
  const d =
    defender.stats[physical ? 'def' : 'spd'] * stageMult(crit ? Math.min(0, defStage) : defStage);
  const base = baseDamage(attacker.level, move.power, a, d);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const burn = physical && attacker.ailment === 'burn' ? 0.5 : 1;
  const amount = Math.floor(base * stab * eff * (crit ? 1.5 : 1) * roll * burn);
  return { amount: Math.max(1, amount), effectiveness: eff, crit };
}

const other = (side: Side): Side => (side === 'player' ? 'wild' : 'player');

interface Ctx {
  state: BattleState;
  events: BattleEvent[];
}

function fighter(ctx: Ctx, side: Side): Fighter {
  return ctx.state[side].fighter;
}

function hurt(ctx: Ctx, side: Side, amount: number): number {
  const f = fighter(ctx, side);
  const dealt = Math.min(f.hp, amount);
  f.hp -= dealt;
  return dealt;
}

function heal(ctx: Ctx, side: Side, amount: number): number {
  const f = fighter(ctx, side);
  const healed = Math.min(f.stats.hp - f.hp, Math.max(0, amount));
  f.hp += healed;
  return healed;
}

function applyAilment(ctx: Ctx, side: Side, ailment: Ailment | 'confusion'): boolean {
  const f = fighter(ctx, side);
  if (ailment === 'confusion') {
    if (f.confusedTurns > 0) return false;
    f.confusedTurns = rng.int(ctx.state.rng, 2, 5);
    ctx.events.push({ kind: 'confused', side });
    return true;
  }
  if (f.ailment !== null || immuneTo(f, ailment)) return false;
  f.ailment = ailment;
  if (ailment === 'sleep') f.sleepTurns = rng.int(ctx.state.rng, 1, 3);
  if (ailment === 'toxic') f.toxicCounter = 1;
  ctx.events.push({ kind: 'ailment', side, ailment });
  return true;
}

function applyStats(ctx: Ctx, side: Side, changes: Partial<Record<StatKey, number>>): boolean {
  const f = fighter(ctx, side);
  let changed = false;
  for (const [stat, change] of Object.entries(changes) as [StatKey, number][]) {
    const before = f.stages[stat];
    f.stages[stat] = Math.max(-6, Math.min(6, before + change));
    const delta = f.stages[stat] - before;
    // delta 0 também vira evento: o cliente mostra "não sobe mais".
    ctx.events.push({ kind: 'stat', side, stat, delta });
    if (delta !== 0) changed = true;
  }
  return changed;
}

/**
 * Sono, gelo, paralisia e confusão, ANTES da ação. Devolve false quando o
 * Pokémon perde a vez.
 */
function canAct(ctx: Ctx, side: Side): boolean {
  const f = fighter(ctx, side);
  const r = ctx.state.rng;

  if (f.ailment === 'sleep') {
    if (f.sleepTurns > 0) {
      f.sleepTurns--;
      ctx.events.push({ kind: 'skip', side, reason: 'sleep' });
      return false;
    }
    f.ailment = null;
    ctx.events.push({ kind: 'cure', side, ailment: 'sleep' });
  }
  if (f.ailment === 'freeze') {
    if (!rng.chance(r, 20)) {
      ctx.events.push({ kind: 'skip', side, reason: 'freeze' });
      return false;
    }
    f.ailment = null;
    ctx.events.push({ kind: 'cure', side, ailment: 'freeze' });
  }
  if (f.ailment === 'paralysis' && rng.chance(r, 25)) {
    ctx.events.push({ kind: 'skip', side, reason: 'paralysis' });
    return false;
  }
  if (f.confusedTurns > 0) {
    f.confusedTurns--;
    if (f.confusedTurns === 0) {
      ctx.events.push({ kind: 'confusionEnd', side });
    } else if (rng.chance(r, 33)) {
      // Golpe de 40 de poder, físico, sem tipo: sem STAB nem efetividade.
      const raw = baseDamage(f.level, 40, effectiveStat(f, 'atk'), effectiveStat(f, 'def'));
      const amount = hurt(ctx, side, raw);
      ctx.events.push({ kind: 'selfHit', side, amount, hp: f.hp });
      return false;
    }
  }
  return true;
}

function hits(ctx: Ctx, side: Side, move: MoveData): boolean {
  if (move.accuracy === 0) return true;
  const self = move.category === 'status' && move.effect?.statTarget === 'self' && !move.effect.ailment;
  if (self || (move.category === 'status' && move.effect?.heal)) return true;
  const stage = fighter(ctx, side).stages.acc - fighter(ctx, other(side)).stages.eva;
  return rng.next(ctx.state.rng) * 100 < move.accuracy * accuracyMult(stage);
}

function useMove(ctx: Ctx, side: Side, move: MoveData): void {
  const r = ctx.state.rng;
  const foe = other(side);
  const user = fighter(ctx, side);
  const target = fighter(ctx, foe);
  const effect = move.effect ?? {};

  ctx.events.push({ kind: 'move', side, moveId: move.id, name: move.name, type: move.type });

  if (!hits(ctx, side, move)) {
    ctx.events.push({ kind: 'miss', side });
    return;
  }

  let didSomething = false;

  if (move.category !== 'status') {
    const roll = 0.85 + rng.next(r) * 0.15;
    const crit = rng.chance(r, 100 / 24);
    const dmg = damageOf(user, target, move, roll, crit);
    if (dmg.effectiveness === 0) {
      ctx.events.push({ kind: 'damage', side: foe, amount: 0, hp: target.hp, effectiveness: 0, crit: false });
      return;
    }
    const dealt = hurt(ctx, foe, dmg.amount);
    ctx.events.push({
      kind: 'damage',
      side: foe,
      amount: dealt,
      hp: target.hp,
      effectiveness: dmg.effectiveness,
      crit: dmg.crit,
    });
    didSomething = true;
    if (effect.drain && dealt > 0) {
      const healed = heal(ctx, side, Math.max(1, Math.floor((dealt * effect.drain) / 100)));
      if (healed > 0) ctx.events.push({ kind: 'heal', side, amount: healed, hp: user.hp });
    }
    if (target.hp === 0) return;
  }

  if (effect.heal) {
    const healed = heal(ctx, side, Math.floor((user.stats.hp * effect.heal) / 100));
    if (healed > 0) {
      ctx.events.push({ kind: 'heal', side, amount: healed, hp: user.hp });
      didSomething = true;
    }
  }

  if (effect.ailment && rng.chance(r, effect.ailmentChance ?? 0)) {
    if (applyAilment(ctx, foe, effect.ailment)) didSomething = true;
  }

  if (effect.stats && rng.chance(r, effect.statChance ?? 0)) {
    const statSide = effect.statTarget === 'self' ? side : foe;
    if (applyStats(ctx, statSide, effect.stats)) didSomething = true;
  }

  if (!didSomething && move.category === 'status') ctx.events.push({ kind: 'fail', side });
}

/** Queimadura e veneno no fim do turno. */
function residual(ctx: Ctx, side: Side): void {
  const f = fighter(ctx, side);
  if (f.hp === 0) return;
  let amount: number;
  if (f.ailment === 'burn') amount = Math.floor(f.stats.hp / 16);
  else if (f.ailment === 'poison') amount = Math.floor(f.stats.hp / 8);
  else if (f.ailment === 'toxic') {
    amount = Math.floor((f.stats.hp * f.toxicCounter) / 16);
    f.toxicCounter = Math.min(15, f.toxicCounter + 1);
  } else return;
  const dealt = hurt(ctx, side, Math.max(1, amount));
  ctx.events.push({ kind: 'residual', side, ailment: f.ailment, amount: dealt, hp: f.hp });
}

/**
 * Valor esperado de uma carta para a IA, em "HP do adversário". Dano conta o
 * que tira (com bônus enorme se nocauteia); status vale uma fração do HP.
 */
function cardValue(state: BattleState, side: Side, move: MoveData): number {
  const me = state[side].fighter;
  const foe = state[other(side)].fighter;
  const e = move.effect ?? {};
  const acc = move.accuracy === 0 ? 1 : move.accuracy / 100;
  let value = 0;

  if (move.category !== 'status') {
    const expected = damageOf(me, foe, move, 0.925, false).amount;
    value += Math.min(expected, foe.hp) * acc;
    if (expected * 0.85 >= foe.hp) value += foe.stats.hp;
  }
  if (e.heal) {
    const missing = me.stats.hp - me.hp;
    value += me.hp / me.stats.hp < 0.5 ? Math.min(missing, (me.stats.hp * e.heal) / 100) : 0;
  }
  if (e.ailment) {
    const p = (e.ailmentChance ?? 0) / 100;
    const free = e.ailment === 'confusion' ? foe.confusedTurns === 0 : foe.ailment === null && !immuneTo(foe, e.ailment);
    if (free) value += foe.stats.hp * 0.25 * p * acc;
  }
  if (e.stats) {
    const p = (e.statChance ?? 0) / 100;
    const mine = e.statTarget === 'self';
    const fresh = me.hp / me.stats.hp > 0.6;
    const total = Object.values(e.stats).reduce((s, n) => s + (n ?? 0), 0);
    // Buff no começo da luta, debuff a qualquer hora; nunca auto-debuff.
    if (mine && total > 0) value += fresh ? me.stats.hp * 0.12 * total * p : 0;
    if (!mine && total < 0) value += foe.stats.hp * 0.06 * -total * p * acc;
  }
  return value;
}

/**
 * A carta que a IA joga: a melhor em `greedy` das vezes, senão aleatória. O
 * simulador usa `greedy = 1` no lado do jogador para imitar alguém que joga bem.
 */
export function chooseCard(state: BattleState, side: Side, greedy = AI_GREEDY): Card {
  const hand = state[side].hand;
  if (!rng.chance(state.rng, greedy * 100)) return hand[rng.int(state.rng, 0, hand.length - 1)];
  let best = hand[0];
  let bestValue = -Infinity;
  for (const card of hand) {
    const value = cardValue(state, side, moveData(card.moveId));
    if (value > bestValue) {
      best = card;
      bestValue = value;
    }
  }
  return best;
}

function takeFromHand(side: SideState, uid: string): Card | null {
  const i = side.hand.findIndex((c) => c.uid === uid);
  if (i === -1) return null;
  const [card] = side.hand.splice(i, 1);
  side.discard.push(card);
  return card;
}

/** Quem age primeiro: prioridade do golpe, depois Spe efetivo, empate na moeda. */
function order(state: BattleState, playerMove: MoveData, wildMove: MoveData): Side[] {
  if (playerMove.priority !== wildMove.priority) {
    return playerMove.priority > wildMove.priority ? ['player', 'wild'] : ['wild', 'player'];
  }
  const ps = effectiveStat(state.player.fighter, 'spe');
  const ws = effectiveStat(state.wild.fighter, 'spe');
  if (ps !== ws) return ps > ws ? ['player', 'wild'] : ['wild', 'player'];
  return rng.chance(state.rng, 50) ? ['player', 'wild'] : ['wild', 'player'];
}

function settle(ctx: Ctx): boolean {
  const { player, wild } = ctx.state;
  if (player.fighter.hp > 0 && wild.fighter.hp > 0) return false;
  if (wild.fighter.hp === 0) ctx.events.push({ kind: 'faint', side: 'wild' });
  if (player.fighter.hp === 0) ctx.events.push({ kind: 'faint', side: 'player' });
  // Os dois caindo juntos (veneno) é derrota: vencer exige estar de pé.
  ctx.state.outcome = player.fighter.hp > 0 ? 'won' : 'lost';
  ctx.events.push({ kind: 'end', outcome: ctx.state.outcome });
  return true;
}

/**
 * Um turno: o jogador joga `uid`, o selvagem responde. Não altera `input` —
 * devolve um estado novo (o route só grava se tudo der certo).
 */
export function playCard(input: BattleState, uid: string): { state: BattleState; events: BattleEvent[] } {
  if (input.outcome !== 'active') throw new BattleError('BATTLE_OVER');
  const state: BattleState = structuredClone(input);
  const ctx: Ctx = { state, events: [] };

  const playerCard = takeFromHand(state.player, uid);
  if (!playerCard) throw new BattleError('INVALID_CARD');
  const wildCard = takeFromHand(state.wild, chooseCard(state, 'wild').uid)!;

  const moves: Record<Side, MoveData> = {
    player: moveData(playerCard.moveId),
    wild: moveData(wildCard.moveId),
  };

  for (const side of order(state, moves.player, moves.wild)) {
    if (canAct(ctx, side)) useMove(ctx, side, moves[side]);
    if (settle(ctx)) return { state, events: ctx.events };
  }

  residual(ctx, 'player');
  residual(ctx, 'wild');
  if (settle(ctx)) return { state, events: ctx.events };

  draw(state.rng, state.player);
  draw(state.rng, state.wild);

  if (state.turn >= MAX_TURNS) {
    state.outcome = 'lost';
    ctx.events.push({ kind: 'timeout' }, { kind: 'end', outcome: 'lost' });
    return { state, events: ctx.events };
  }
  state.turn++;
  return { state, events: ctx.events };
}

/** Desistência: derrota imediata. */
export function forfeit(input: BattleState): BattleState {
  if (input.outcome !== 'active') throw new BattleError('BATTLE_OVER');
  return { ...input, outcome: 'lost' };
}

export function hpRatio(state: BattleState): number {
  const f = state.player.fighter;
  return f.hp / f.stats.hp;
}
