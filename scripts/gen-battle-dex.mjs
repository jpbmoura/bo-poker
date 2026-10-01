#!/usr/bin/env node
// Gera server/src/battle/battleDex.generated.ts a partir da PokéAPI: tipos, base
// stats e learnset de level-up de cada forma do pokedex.ts, mais os golpes que a
// batalha de cartas sabe executar. Roda UMA vez (e de novo ao mexer no pokedex
// ou nos efeitos suportados); o resultado vai commitado — nada disto roda em
// produção.
//
//   node scripts/gen-battle-dex.mjs
//
// A MONTAGEM do deck não é feita aqui: ela depende do nível do Pokémon na
// batalha e fica em server/src/battle/deck.ts.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'server/src/data/pokedex.ts');
const TARGET = path.join(root, 'server/src/battle/battleDex.generated.ts');
const API = 'https://pokeapi.co/api/v2';

/**
 * Ordem de preferência do learnset: o jogo mais novo em que a espécie aparece.
 * Gen 1–3 não estão em Scarlet/Violet, então caem em SwSh, USUM…
 */
const VERSION_GROUPS = [
  'scarlet-violet', 'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon',
  'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl', 'emerald',
  'firered-leafgreen', 'ruby-sapphire', 'crystal', 'gold-silver', 'yellow', 'red-blue',
];

const AILMENTS = new Set(['paralysis', 'sleep', 'freeze', 'burn', 'poison', 'confusion']);
const STATS = {
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
  accuracy: 'acc',
  evasion: 'eva',
};
const SELF_TARGETS = new Set(['user', 'user-or-ally', 'users-field', 'user-and-allies']);

/** Golpes que entram como fallback quando o learnset não tem nada utilizável. */
const FALLBACK_MOVES = ['tackle', 'struggle'];

const source = await readFile(SOURCE, 'utf8');
const dexIds = [
  ...new Set([...source.matchAll(/\{ id: (\d+), name:/g)].map((m) => Number(m[1]))),
].sort((a, b) => a - b);

async function getJson(url, tries = 4) {
  for (let i = 0; ; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (i >= tries) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const idFromUrl = (url) => Number(/\/(\d+)\/?$/.exec(url)[1]);

console.log(`lendo ${dexIds.length} formas…`);
const pokemon = await pool(dexIds, 16, (id) => getJson(`${API}/pokemon/${id}/`));

const statOf = (p, name) => p.stats.find((s) => s.stat.name === name).base_stat;

/** Learnset de level-up do jogo preferido: [[slug, nível], …]. */
function learnset(p) {
  const byGroup = new Map();
  for (const m of p.moves) {
    for (const d of m.version_group_details) {
      if (d.move_learn_method.name !== 'level-up') continue;
      const list = byGroup.get(d.version_group.name) ?? [];
      // Nível 0 é o golpe "ao evoluir" dos jogos novos: vale desde o início.
      list.push([m.move.name, Math.max(1, d.level_learned_at)]);
      byGroup.set(d.version_group.name, list);
    }
  }
  const group = VERSION_GROUPS.find((g) => byGroup.has(g));
  if (!group) return [];
  const best = new Map();
  for (const [slug, level] of byGroup.get(group)) {
    best.set(slug, Math.min(level, best.get(slug) ?? Infinity));
  }
  return [...best].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

const species = pokemon.map((p) => ({
  id: p.id,
  types: p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((s) =>
    statOf(p, s),
  ),
  learnset: learnset(p),
}));

const slugs = [
  ...new Set([...species.flatMap((s) => s.learnset.map(([slug]) => slug)), ...FALLBACK_MOVES]),
];
console.log(`lendo ${slugs.length} golpes…`);
const rawMoves = await pool(slugs, 16, (slug) => getJson(`${API}/move/${slug}/`));

/**
 * Normaliza um golpe para o formato da batalha, ou null se ele não faz nada que
 * o motor saiba executar. Golpe de dano com efeito desconhecido entra só como
 * dano; golpe de status com efeito desconhecido fica de fora.
 */
function normalize(m) {
  const meta = m.meta ?? {};
  const category = meta.category?.name ?? '';
  const isDamage = m.damage_class.name !== 'status';
  if (category === 'ohko' || category === 'unique') return null;
  if (isDamage && !(m.power > 0)) return null; // dano variável/fixo: fora do MVP

  const effect = {};
  const ailment = meta.ailment?.name;
  if (AILMENTS.has(ailment)) {
    effect.ailment = m.name === 'toxic' ? 'toxic' : ailment;
    // Golpe de status que só aplica ailment acerta "sempre" (chance 0 na API).
    effect.ailmentChance = isDamage ? meta.ailment_chance || 0 : 100;
    if (isDamage && !effect.ailmentChance) delete effect.ailment;
    if (!effect.ailment) delete effect.ailmentChance;
  }

  const changes = (m.stat_changes ?? [])
    .map((c) => [STATS[c.stat.name], c.change])
    .filter(([stat, change]) => stat && change);
  if (changes.length) {
    const self = isDamage ? category === 'damage-raise' : SELF_TARGETS.has(m.target.name);
    const chance = isDamage ? meta.stat_chance || 0 : 100;
    if (chance > 0) {
      effect.stats = Object.fromEntries(changes);
      effect.statTarget = self ? 'self' : 'foe';
      effect.statChance = chance;
    }
  }

  if (meta.healing > 0 && !isDamage) effect.heal = meta.healing;
  if (meta.drain > 0 && isDamage) effect.drain = meta.drain;

  if (!isDamage && !effect.ailment && !effect.stats && !effect.heal) return null;
  const name = m.names.find((n) => n.language.name === 'en')?.name ?? m.name;
  return {
    id: m.id,
    slug: m.name,
    name,
    type: m.type.name,
    category: isDamage ? m.damage_class.name : 'status',
    power: isDamage ? m.power : 0,
    accuracy: m.accuracy ?? 0, // 0 = nunca erra (Swift, Swords Dance…)
    priority: m.priority,
    ...(Object.keys(effect).length ? { effect } : {}),
  };
}

const moves = new Map();
for (const raw of rawMoves) {
  const move = normalize(raw);
  if (move) moves.set(move.slug, move);
}

const out = species.map((s) => ({
  ...s,
  learnset: s.learnset.filter(([slug]) => moves.has(slug)).map(([slug, lvl]) => [moves.get(slug).id, lvl]),
}));
const empty = out.filter((s) => s.learnset.length === 0).map((s) => s.id);
if (empty.length) console.log(`sem golpe utilizável (usam fallback): ${empty.join(', ')}`);

const usedIds = new Set(out.flatMap((s) => s.learnset.map(([id]) => id)));
for (const slug of FALLBACK_MOVES) usedIds.add(moves.get(slug).id);
const moveList = [...moves.values()].filter((m) => usedIds.has(m.id)).sort((a, b) => a.id - b.id);

const fmtMove = (m) => {
  const { slug: _slug, ...rest } = m;
  return `  ${m.id}: ${JSON.stringify(rest)},`;
};
const fmtSpecies = (s) =>
  `  ${s.id}: { types: ${JSON.stringify(s.types)}, stats: ${JSON.stringify(s.stats)}, learnset: ${JSON.stringify(s.learnset)} },`;

const text = `// Gerado por scripts/gen-battle-dex.mjs a partir da PokéAPI. Não editar à mão.
import type { BattleSpecies, MoveData } from './types.js';

export const FALLBACK_MOVE_IDS: number[] = ${JSON.stringify(FALLBACK_MOVES.map((s) => moves.get(s).id))};

export const BATTLE_MOVES: Record<number, MoveData> = {
${moveList.map(fmtMove).join('\n')}
};

/** Por dex id. \`stats\` = [hp, atk, def, spa, spd, spe]; \`learnset\` = [[moveId, nível], …]. */
export const BATTLE_SPECIES: Record<number, BattleSpecies> = {
${out.map(fmtSpecies).join('\n')}
};
`;

await writeFile(TARGET, text);
console.log(`${out.length} formas e ${moveList.length} golpes em ${path.relative(root, TARGET)}.`);
