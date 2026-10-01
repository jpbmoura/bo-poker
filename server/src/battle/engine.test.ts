import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVOLUTION_LINES } from '../data/pokedex.js';
import {
  DECK_DISTINCT,
  DECK_MAX_STATUS,
  DECK_MIN_SIZE,
  HAND_SIZE,
  MAX_LEVEL,
  MAX_TURNS,
  MIN_LEVEL,
  battleBonus,
  captureChance,
  playerLevel,
  wildLevel,
} from './balance.js';
import { BATTLE_MOVES, BATTLE_SPECIES } from './battleDex.generated.js';
import { buildDeck, pickMoves } from './deck.js';
import {
  BattleError,
  chooseCard,
  createBattle,
  damageOf,
  forfeit,
  playCard,
  type BattleState,
  type Card,
} from './engine.js';
import { effectiveness } from './typeChart.js';

const BULBASAUR = 1;
const CHARMANDER = 4;
const SQUIRTLE = 7;
const PIKACHU = 25;
const GEODUDE = 74;
const MAGIKARP = 129;

const SWORDS_DANCE = 14;
const TACKLE = 33;
const EMBER = 52;
const THUNDER_SHOCK = 84;
const THUNDER_WAVE = 86;
const RECOVER = 105;
const HARDEN = 106;
const WILL_O_WISP = 261;

function battle(playerDex: number, wildDex: number, seed = 1, level = 30): BattleState {
  return createBattle(
    { dexId: playerDex, name: 'eu', level },
    { dexId: wildDex, name: 'selvagem', level },
    seed,
  );
}

/** Troca as mãos por cartas fixas: deixa o teste escolher o golpe dos dois lados. */
function rig(state: BattleState, player: number[], wild: number[]): void {
  const cards = (prefix: string, ids: number[]): Card[] => ids.map((moveId, i) => ({ uid: `${prefix}x${i}`, moveId }));
  state.player.hand = cards('p', player);
  state.wild.hand = cards('w', wild);
  state.player.deck = cards('pd', player);
  state.wild.deck = cards('wd', wild);
  state.player.discard = [];
  state.wild.discard = [];
}

const totalCards = (s: BattleState['player']) => s.deck.length + s.hand.length + s.discard.length;

test('tabela de tipos: vantagem, resistência, imunidade e tipo duplo', () => {
  assert.equal(effectiveness('fire', ['grass']), 2);
  assert.equal(effectiveness('fire', ['water']), 0.5);
  assert.equal(effectiveness('electric', ['ground']), 0);
  assert.equal(effectiveness('normal', ['ghost']), 0);
  assert.equal(effectiveness('ice', ['dragon', 'flying']), 4);
  assert.equal(effectiveness('water', ['rock', 'ground']), 4);
  assert.equal(effectiveness('dragon', ['fairy']), 0);
});

test('toda forma do pokedex tem dados e um deck com dano em qualquer nível', () => {
  for (const line of EVOLUTION_LINES) {
    const forms = [...line.stages, ...(line.branches ?? []).flat()];
    for (const form of forms) {
      assert.ok(BATTLE_SPECIES[form.id], `sem dados para ${form.name}`);
      for (const level of [1, MIN_LEVEL, MAX_LEVEL]) {
        const moves = pickMoves(form.id, level);
        assert.ok(moves.some((m) => m.category !== 'status'), `${form.name} L${level} sem golpe de dano`);
        assert.ok(buildDeck(form.id, level).length >= DECK_MIN_SIZE);
      }
    }
  }
});

test('todo golpe do learnset gerado existe no catálogo', () => {
  for (const [dex, species] of Object.entries(BATTLE_SPECIES)) {
    for (const [moveId] of species.learnset) assert.ok(BATTLE_MOVES[moveId], `golpe ${moveId} de ${dex}`);
  }
});

test('o deck respeita o nível, o teto de golpes distintos e o de status', () => {
  const learnset = new Map(BATTLE_SPECIES[BULBASAUR].learnset);
  for (const level of [5, 20, 40, 60]) {
    const moves = pickMoves(BULBASAUR, level);
    assert.ok(moves.length <= DECK_DISTINCT);
    assert.ok(moves.filter((m) => m.category === 'status').length <= DECK_MAX_STATUS);
    for (const m of moves) assert.ok(learnset.get(m.id)! <= level, `${m.name} acima de L${level}`);
  }
  // Magikarp só aprende Tackle no 15: antes disso, cai no fallback.
  assert.deepEqual(pickMoves(MAGIKARP, 10).map((m) => m.id), [TACKLE]);
});

test('mesma seed, mesma batalha', () => {
  const run = () => {
    let s = battle(CHARMANDER, BULBASAUR, 42);
    const log: string[] = [];
    while (s.outcome === 'active') {
      const r = playCard(s, chooseCard(s, 'player', 1).uid);
      log.push(JSON.stringify(r.events));
      s = r.state;
    }
    return log.join('\n');
  };
  assert.equal(run(), run());
});

test('playCard não muda o estado de entrada e mantém a mão cheia', () => {
  const s = battle(CHARMANDER, BULBASAUR);
  const snapshot = JSON.stringify(s);
  const { state } = playCard(s, s.player.hand[0].uid);
  assert.equal(JSON.stringify(s), snapshot);
  if (state.outcome === 'active') {
    assert.equal(state.player.hand.length, HAND_SIZE);
    assert.equal(state.wild.hand.length, HAND_SIZE);
  }
  assert.equal(totalCards(state.player), totalCards(s.player));
  assert.equal(totalCards(state.wild), totalCards(s.wild));
});

test('carta fora da mão e batalha encerrada são recusadas', () => {
  const s = battle(CHARMANDER, BULBASAUR);
  assert.throws(() => playCard(s, 'nao-existe'), (e) => e instanceof BattleError && e.code === 'INVALID_CARD');
  const over = forfeit(s);
  assert.equal(over.outcome, 'lost');
  assert.throws(() => playCard(over, over.player.hand[0].uid), (e) => e instanceof BattleError && e.code === 'BATTLE_OVER');
});

test('o descarte volta embaralhado quando o deck acaba', () => {
  const s = battle(CHARMANDER, BULBASAUR, 7, 55);
  rig(s, [HARDEN, HARDEN, HARDEN], [HARDEN, HARDEN, HARDEN]);
  s.player.deck = [];
  s.player.discard = [{ uid: 'velha', moveId: TACKLE }];
  const { state } = playCard(s, 'px0');
  // Descarte (a velha + a que acabou de jogar) virou deck, e a mão completou.
  assert.equal(state.player.hand.length, HAND_SIZE);
  assert.equal(state.player.discard.length, 0);
  assert.equal(state.player.deck.length, 1);
});

test('dano: STAB e efetividade pesam, imunidade zera', () => {
  const s = battle(CHARMANDER, BULBASAUR);
  const charmander = s.player.fighter;
  const ember = BATTLE_MOVES[EMBER];
  const vsGrass = damageOf(charmander, s.wild.fighter, ember, 1, false);
  const vsWater = damageOf(charmander, battle(SQUIRTLE, SQUIRTLE).wild.fighter, ember, 1, false);
  assert.equal(vsGrass.effectiveness, 2);
  assert.equal(vsWater.effectiveness, 0.5);
  assert.ok(vsGrass.amount > vsWater.amount * 3);

  const pika = battle(PIKACHU, GEODUDE);
  const zero = damageOf(pika.player.fighter, pika.wild.fighter, BATTLE_MOVES[THUNDER_SHOCK], 1, false);
  assert.equal(zero.effectiveness, 0);
  assert.equal(zero.amount, 0);
});

test('estágios de stat param em +6', () => {
  let s = battle(CHARMANDER, BULBASAUR, 3, 50);
  for (let i = 0; i < 5; i++) {
    rig(s, [SWORDS_DANCE], [HARDEN]);
    s = playCard(s, 'px0').state;
  }
  assert.equal(s.player.fighter.stages.atk, 6);
  assert.equal(s.wild.fighter.stages.def, 5);
  rig(s, [SWORDS_DANCE], [HARDEN]);
  const { events } = playCard(s, 'px0');
  assert.ok(events.some((e) => e.kind === 'stat' && e.side === 'player' && e.delta === 0));
});

test('cura nunca passa do HP máximo e falha com HP cheio', () => {
  const s = battle(BULBASAUR, CHARMANDER, 3, 50);
  s.player.fighter.hp = s.player.fighter.stats.hp - 1;
  rig(s, [RECOVER], [HARDEN]);
  const first = playCard(s, 'px0');
  assert.equal(first.state.player.fighter.hp, first.state.player.fighter.stats.hp);
  rig(first.state, [RECOVER], [HARDEN]);
  const second = playCard(first.state, 'px0');
  assert.ok(second.events.some((e) => e.kind === 'fail' && e.side === 'player'));
});

test('imunidade de tipo a status: elétrico não paralisa, fogo não queima', () => {
  for (const [wild, move] of [[PIKACHU, THUNDER_WAVE], [CHARMANDER, WILL_O_WISP]] as const) {
    // Seeds diferentes para o teste não depender de acertar o golpe de 85–90%.
    for (let seed = 1; seed <= 20; seed++) {
      const s = battle(BULBASAUR, wild, seed, 50);
      rig(s, [move], [HARDEN]);
      const { state } = playCard(s, 'px0');
      assert.equal(state.wild.fighter.ailment, null);
    }
  }
});

test('queimadura tira 1/16 por turno; Toxic cresce', () => {
  const s = battle(BULBASAUR, SQUIRTLE, 3, 50);
  s.wild.fighter.ailment = 'burn';
  rig(s, [HARDEN], [HARDEN]);
  const burned = playCard(s, 'px0');
  const tick = burned.events.find((e) => e.kind === 'residual');
  assert.ok(tick && tick.kind === 'residual');
  assert.equal(tick.amount, Math.floor(s.wild.fighter.stats.hp / 16));

  const t = battle(BULBASAUR, SQUIRTLE, 3, 50);
  t.wild.fighter.ailment = 'toxic';
  t.wild.fighter.toxicCounter = 1;
  let state = t;
  const ticks: number[] = [];
  for (let i = 0; i < 3; i++) {
    rig(state, [HARDEN], [HARDEN]);
    const r = playCard(state, 'px0');
    const e = r.events.find((ev) => ev.kind === 'residual');
    if (e?.kind === 'residual') ticks.push(e.amount);
    state = r.state;
  }
  assert.equal(ticks.length, 3);
  assert.ok(ticks[0] < ticks[1] && ticks[1] < ticks[2]);
});

test('dormindo perde a vez', () => {
  const s = battle(BULBASAUR, SQUIRTLE, 3, 50);
  s.wild.fighter.ailment = 'sleep';
  s.wild.fighter.sleepTurns = 2;
  rig(s, [HARDEN], [TACKLE]);
  const { events, state } = playCard(s, 'px0');
  assert.ok(events.some((e) => e.kind === 'skip' && e.side === 'wild' && e.reason === 'sleep'));
  assert.equal(state.player.fighter.hp, state.player.fighter.stats.hp);
  assert.equal(state.wild.fighter.sleepTurns, 1);
});

test(`depois de ${MAX_TURNS} turnos a batalha acaba em derrota`, () => {
  const s = battle(BULBASAUR, SQUIRTLE, 3, 50);
  s.turn = MAX_TURNS;
  rig(s, [HARDEN], [HARDEN]);
  const { state, events } = playCard(s, 'px0');
  assert.equal(state.outcome, 'lost');
  assert.ok(events.some((e) => e.kind === 'timeout'));
});

test('nocaute encerra com vitória e evento de fim', () => {
  const s = battle(CHARMANDER, BULBASAUR, 3, 50);
  s.wild.fighter.hp = 1;
  rig(s, [EMBER], [HARDEN]);
  const { state, events } = playCard(s, 'px0');
  assert.equal(state.outcome, 'won');
  assert.deepEqual(events.at(-1), { kind: 'end', outcome: 'won' });
});

test('balance: bônus, teto da chance e níveis', () => {
  assert.equal(battleBonus(0), 20);
  assert.equal(battleBonus(1), 50);
  assert.equal(battleBonus(0.5), 35);
  assert.equal(captureChance(60, 50), 95);
  assert.equal(captureChance(5, 20), 25);
  assert.equal(playerLevel(0), MIN_LEVEL);
  assert.equal(playerLevel(100_000), MAX_LEVEL);
  assert.ok(wildLevel('legendary', MIN_LEVEL) >= wildLevel('common', MIN_LEVEL));
});
