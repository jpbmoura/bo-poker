import { DECK_DISTINCT, DECK_MAX_STATUS, DECK_MIN_SIZE } from './balance.js';
import { BATTLE_MOVES, BATTLE_SPECIES, FALLBACK_MOVE_IDS } from './battleDex.generated.js';
import type { BattleSpecies, MoveData } from './types.js';

export function speciesData(dexId: number): BattleSpecies {
  const data = BATTLE_SPECIES[dexId];
  if (!data) throw new Error(`sem dados de batalha para o dex ${dexId}`);
  return data;
}

export function moveData(moveId: number): MoveData {
  const move = BATTLE_MOVES[moveId];
  if (!move) throw new Error(`golpe desconhecido: ${moveId}`);
  return move;
}

/** Força "de papel" de um golpe de dano para este Pokémon: poder × STAB × precisão. */
function damageScore(move: MoveData, species: BattleSpecies): number {
  const stab = species.types.includes(move.type) ? 1.5 : 1;
  const acc = move.accuracy === 0 ? 1 : move.accuracy / 100;
  return move.power * stab * acc;
}

/** Status mais úteis primeiro: cura, depois status principal, depois stat. */
function statusScore(move: MoveData): number {
  const e = move.effect ?? {};
  if (e.heal) return 3;
  if (e.ailment && e.ailment !== 'confusion') return 2;
  return 1;
}

/**
 * Os golpes distintos que viram carta, a partir do learnset ATÉ o nível do
 * Pokémon: subir de nível libera golpes melhores.
 *
 * Prioriza 2 golpes de dano com STAB, completa com os outros danos mais fortes
 * (no máximo um por tipo, para variar) e reserva até DECK_MAX_STATUS vagas para
 * status. Empates ficam com o golpe aprendido mais tarde, que costuma ser o
 * "da forma atual".
 */
export function pickMoves(dexId: number, level: number): MoveData[] {
  const species = speciesData(dexId);
  const learned = species.learnset
    .filter(([, lvl]) => lvl <= level)
    .map(([id]) => moveData(id))
    .reverse(); // mais recente primeiro: desempata a favor dele no sort estável

  const damage = learned
    .filter((m) => m.category !== 'status')
    .sort((a, b) => damageScore(b, species) - damageScore(a, species));
  const status = learned
    .filter((m) => m.category === 'status')
    .sort((a, b) => statusScore(b) - statusScore(a));

  const picked: MoveData[] = [];
  const has = (m: MoveData) => picked.some((p) => p.id === m.id);

  for (const m of damage.filter((d) => species.types.includes(d.type)).slice(0, 2)) picked.push(m);
  const statusSlots = Math.min(DECK_MAX_STATUS, status.length);
  const damageSlots = DECK_DISTINCT - statusSlots;
  for (const m of damage) {
    if (picked.length >= damageSlots) break;
    if (has(m) || picked.some((p) => p.type === m.type && p.category !== 'status')) continue;
    picked.push(m);
  }
  for (const m of damage) {
    if (picked.length >= damageSlots) break;
    if (!has(m)) picked.push(m);
  }
  for (const m of status.slice(0, statusSlots)) picked.push(m);

  // Ditto, Abra e Magikarp de nível baixo não têm um único golpe de dano: sem
  // isto eles nunca venceriam.
  if (!picked.some((m) => m.category !== 'status')) {
    picked.push(moveData(FALLBACK_MOVE_IDS[0]));
  }
  return picked;
}

/** Cópias de cada golpe: o fraco aparece mais, o forte e o status menos. */
function copiesOf(move: MoveData): number {
  if (move.category === 'status') return 2;
  return move.power >= 80 ? 2 : 3;
}

/** Lista de move ids do deck, ainda sem embaralhar. */
export function buildDeck(dexId: number, level: number): number[] {
  const moves = pickMoves(dexId, level);
  const deck: number[] = [];
  for (const m of moves) for (let i = 0; i < copiesOf(m); i++) deck.push(m.id);
  // Repete o deck inteiro (não só um golpe) para manter a proporção.
  const base = [...deck];
  while (deck.length < DECK_MIN_SIZE) deck.push(...base);
  return deck;
}
