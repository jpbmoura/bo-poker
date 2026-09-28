#!/usr/bin/env node
// Gera o bloco WILD_LINES do pokedex.ts a partir das evolution chains da PokéAPI.
// Roda UMA vez (e de novo só ao subir WILD_MAX_DEX); o resultado vai commitado —
// nada disto roda em produção.
//
//   node scripts/gen-wild-dex.mjs            # usa WILD_MAX_DEX lido do pokedex.ts
//
// Reescreve, nos DOIS pokedex.ts (client e server), o trecho entre os marcadores
// `// BEGIN WILD_LINES` e `// END WILD_LINES`, mantendo-os byte-idênticos.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  path.join(root, 'server/src/data/pokedex.ts'),
  path.join(root, 'client/src/data/pokedex.ts'),
];
const BEGIN = '// BEGIN WILD_LINES';
const END = '// END WILD_LINES';
const API = 'https://pokeapi.co/api/v2';

/** Pseudo-lendários: sobem um tier. Pelo slug da linha. */
const PSEUDO = new Set(['dratini', 'larvitar', 'bagon', 'beldum']);

const source = await readFile(TARGETS[0], 'utf8');
const maxDex = Number(/export const WILD_MAX_DEX = (\d+);/.exec(source)?.[1]);
if (!maxDex) throw new Error('WILD_MAX_DEX não encontrado no pokedex.ts');

// Linhas escritas à mão (iniciais + curingas) não são geradas de novo: o slug
// delas já está no banco e elas carregam `starter: true`.
const handWritten = new Set(
  [...source.slice(0, source.indexOf(BEGIN)).matchAll(/\{ id: '([a-z0-9-]+)', gen:/g)].map(
    (m) => m[1],
  ),
);
handWritten.add('eevee'); // declarada via EEVEE_LINE_ID

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

console.log(`lendo espécies 1..${maxDex}…`);
const species = await pool(
  Array.from({ length: maxDex }, (_, i) => i + 1),
  16,
  (id) => getJson(`${API}/pokemon-species/${id}/`),
);

const byId = new Map();
for (const s of species) {
  byId.set(s.id, {
    id: s.id,
    slug: s.name,
    name: s.names.find((n) => n.language.name === 'en')?.name ?? s.name,
    legendary: s.is_legendary || s.is_mythical,
    gen: idFromUrl(s.generation.url),
    chain: s.evolution_chain.url,
  });
}

const chainUrls = [...new Set([...byId.values()].map((s) => s.chain))];
console.log(`lendo ${chainUrls.length} evolution chains…`);
const chains = await pool(chainUrls, 16, (url) => getJson(url));

/** Poda a árvore para espécies <= maxDex, subindo filhos de nós cortados. */
function prune(node) {
  const id = idFromUrl(node.species.url);
  const kids = node.evolves_to.flatMap(prune);
  if (id > maxDex) return kids;
  return [{ id, kids }];
}

const entry = (id) => ({ id, name: byId.get(id).name });

/** Caminho linear a partir de um nó; falha se ramificar de novo. */
function path1(node) {
  const out = [entry(node.id)];
  let cur = node;
  while (cur.kids.length === 1) {
    cur = cur.kids[0];
    out.push(entry(cur.id));
  }
  if (cur.kids.length > 1) throw new Error(`ramo dentro de ramo em ${node.id}`);
  return out;
}

const lines = [];
for (const chain of chains) {
  const roots = prune(chain.chain);
  if (roots.length !== 1) throw new Error(`cadeia com ${roots.length} raízes: ${chain.id}`);
  const rootSpecies = byId.get(roots[0].id);
  if (handWritten.has(rootSpecies.slug)) continue;

  const stages = [];
  let cur = roots[0];
  stages.push(entry(cur.id));
  while (cur.kids.length === 1) {
    cur = cur.kids[0];
    stages.push(entry(cur.id));
  }
  let branches;
  if (cur.kids.length > 1) {
    branches = cur.kids.map(path1);
    const len = branches[0].length;
    if (branches.some((b) => b.length !== len)) {
      throw new Error(`ramos de tamanhos diferentes em ${rootSpecies.slug}`);
    }
  }
  const total = stages.length + (branches ? branches[0].length : 0);
  if (total > 3) throw new Error(`linha ${rootSpecies.slug} com ${total} estágios`);

  lines.push({
    id: rootSpecies.slug,
    gen: rootSpecies.gen,
    stages,
    branches,
    legendary: rootSpecies.legendary,
    pseudo: PSEUDO.has(rootSpecies.slug),
  });
}
lines.sort((a, b) => a.stages[0].id - b.stages[0].id);

const fmtEntry = (e) => `{ id: ${e.id}, name: ${JSON.stringify(e.name)} }`;
const body = lines
  .map((l) => {
    const parts = [`id: '${l.id}'`, `gen: ${l.gen}`];
    if (l.legendary) parts.push('legendary: true');
    if (l.pseudo) parts.push('pseudo: true');
    let s = `  { ${parts.join(', ')},\n    stages: [${l.stages.map(fmtEntry).join(', ')}]`;
    if (l.branches) {
      s += `,\n    branches: [${l.branches.map((b) => `[${b.map(fmtEntry).join(', ')}]`).join(', ')}]`;
    }
    return `${s} },`;
  })
  .join('\n');

const block = `${BEGIN}\n// Gerado por scripts/gen-wild-dex.mjs (dex <= ${maxDex}). Não editar à mão.\nexport const WILD_LINES: EvolutionLine[] = [\n${body}\n];\n${END}`;

for (const file of TARGETS) {
  const text = await readFile(file, 'utf8');
  const a = text.indexOf(BEGIN);
  const b = text.indexOf(END);
  if (a < 0 || b < 0) throw new Error(`marcadores ausentes em ${file}`);
  await writeFile(file, text.slice(0, a) + block + text.slice(b + END.length));
}
console.log(`${lines.length} linhas geradas em ${TARGETS.length} arquivos.`);
