import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_CHANCE,
  EEVEE_LINE_ID,
  EVOLUTION_LINES,
  SPAWN_WEIGHT,
  STARTER_LINES,
  TIERS,
  WILD_LINES,
  WILD_MAX_DEX,
  XP_THRESHOLDS,
  derivedStage,
  findBranch,
  findLine,
  isStarterLine,
  isValidLineId,
  maxStage,
  nextThreshold,
  resolveForm,
  spriteUrl,
  stageFor,
  tierOf,
  wildSpecies,
  xpForStage,
} from './pokedex.js';

const eevee = findLine(EEVEE_LINE_ID)!;
const charmander = findLine('charmander')!;
const pichu = findLine('pichu')!;
const wurmple = findLine('wurmple')!;

test('iniciais: 29 linhas, 3 por geração + 2 curingas', () => {
  assert.equal(STARTER_LINES.length, 29);
  for (let gen = 1; gen <= 9; gen++) {
    const lines = STARTER_LINES.filter((l) => l.gen === gen);
    assert.equal(lines.length, 3, `geração ${gen} deveria ter 3 iniciais`);
  }
  assert.equal(STARTER_LINES.filter((l) => l.gen === 0).length, 2);
});

test('iniciais: slugs antigos continuam lá (estão no banco)', () => {
  for (const id of ['bulbasaur', 'charmander', 'squirtle', 'mudkip', 'quaxly', 'pichu', EEVEE_LINE_ID]) {
    assert.ok(isStarterLine(id), id);
  }
  assert.ok(!isStarterLine('tauros'));
});

test('catálogo: slugs únicos', () => {
  const ids = EVOLUTION_LINES.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('catálogo: nenhuma linha passa de 3 estágios, ramos têm o mesmo tamanho', () => {
  for (const line of EVOLUTION_LINES) {
    assert.ok(line.stages.length >= 1, line.id);
    assert.ok(maxStage(line) <= XP_THRESHOLDS.length - 1, `${line.id} longa demais`);
    if (line.branches) {
      assert.ok(line.branches.length >= 2, `${line.id} com um ramo só`);
      const len = line.branches[0].length;
      for (const b of line.branches) assert.equal(b.length, len, line.id);
    }
  }
});

test('catálogo: ids da dex são únicos, nomes não são vazios', () => {
  const seen = new Set<number>();
  for (const line of EVOLUTION_LINES) {
    for (const form of [...line.stages, ...(line.branches ?? []).flat()]) {
      assert.ok(!seen.has(form.id), `id ${form.id} (${form.name}) duplicado`);
      seen.add(form.id);
      assert.ok(form.id >= 1 && form.id <= 1025, `id ${form.id} fora da faixa`);
      assert.ok(form.name.length > 0);
    }
  }
});

test('natureza: toda espécie de 1 a WILD_MAX_DEX aparece exatamente uma vez', () => {
  const ids = wildSpecies().map((s) => s.entry.id);
  assert.equal(ids.length, WILD_MAX_DEX);
  assert.deepEqual(ids, Array.from({ length: WILD_MAX_DEX }, (_, i) => i + 1));
});

test('natureza: as linhas geradas só têm espécies <= WILD_MAX_DEX', () => {
  for (const line of WILD_LINES) {
    for (const form of [...line.stages, ...(line.branches ?? []).flat()]) {
      assert.ok(form.id <= WILD_MAX_DEX, `${line.id}: ${form.name}`);
    }
  }
});

test('natureza: espécie de ramo carrega o ramo, a de linha linear não', () => {
  const byDex = new Map(wildSpecies().map((s) => [s.entry.id, s]));
  assert.deepEqual(
    { ...byDex.get(267)!, entry: undefined },
    { lineId: 'wurmple', stage: 2, branchId: 266, entry: undefined, tier: 'epic' },
  );
  assert.equal(byDex.get(134)?.branchId, 134); // Vaporeon
  assert.equal(byDex.get(6)?.branchId, null); // Charizard
  assert.equal(byDex.get(470), undefined); // Leafeon é Gen 4
});

test('tierOf: base, meio, final e lendário', () => {
  assert.equal(tierOf(charmander, 0), 'common');
  assert.equal(tierOf(charmander, 1), 'uncommon');
  assert.equal(tierOf(charmander, 2), 'epic');
  assert.equal(tierOf(pichu, 2), 'epic');
  assert.equal(tierOf(eevee, 1), 'rare');
  assert.equal(tierOf(findLine('tauros')!, 0), 'rare');
  assert.equal(tierOf(findLine('mewtwo')!, 0), 'legendary');
  // Pseudo-lendário sobe um tier.
  assert.equal(tierOf(findLine('dratini')!, 0), 'uncommon');
  assert.equal(tierOf(findLine('dratini')!, 2), 'legendary');
});

test('chance e peso: definidos para todo tier, decrescentes', () => {
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(CAPTURE_CHANCE[TIERS[i]] < CAPTURE_CHANCE[TIERS[i - 1]]);
    assert.ok(SPAWN_WEIGHT[TIERS[i]] < SPAWN_WEIGHT[TIERS[i - 1]]);
  }
});

test('xpForStage nasce exatamente no limiar do estágio', () => {
  assert.equal(xpForStage(0), 0);
  assert.equal(xpForStage(1), 250);
  assert.equal(xpForStage(2), 650);
  assert.equal(stageFor(charmander, xpForStage(1)), 1);
});

test('spriteUrl monta a URL do repositório de sprites por id', () => {
  assert.equal(
    spriteUrl(906),
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/906.png',
  );
});

test('derivedStage: base 0, nas bordas exatas dos limiares', () => {
  assert.deepEqual(XP_THRESHOLDS, [0, 250, 650]);
  assert.equal(derivedStage(0), 0);
  assert.equal(derivedStage(249), 0);
  assert.equal(derivedStage(250), 1);
  assert.equal(derivedStage(649), 1);
  assert.equal(derivedStage(650), 2);
  assert.equal(derivedStage(10_000), 2);
});

test('maxStage: linear, ramificada e estágio único', () => {
  assert.equal(maxStage(charmander), 2);
  assert.equal(maxStage(pichu), 2);
  assert.equal(maxStage(eevee), 1);
  assert.equal(maxStage(wurmple), 2);
  assert.equal(maxStage(findLine('tauros')!), 0);
  assert.equal(maxStage(findLine('magikarp')!), 1);
});

test('stageFor limita o estágio pelo teto da linha', () => {
  assert.equal(stageFor(charmander, 650), 2);
  // O 3º limiar é no-op na linha do Eevee.
  assert.equal(stageFor(eevee, 650), 1);
  assert.equal(stageFor(eevee, 10_000), 1);
});

test('nextThreshold: 250, 650 e null no estágio final', () => {
  assert.equal(nextThreshold(charmander, 0), 250);
  assert.equal(nextThreshold(charmander, 250), 650);
  assert.equal(nextThreshold(charmander, 650), null);
  assert.equal(nextThreshold(eevee, 0), 250);
  assert.equal(nextThreshold(eevee, 250), null);
});

test('resolveForm: linha normal, um estágio por vez', () => {
  assert.deepEqual(resolveForm('charmander', 0, null), { id: 4, name: 'Charmander' });
  assert.deepEqual(resolveForm('charmander', 1, null), { id: 5, name: 'Charmeleon' });
  assert.deepEqual(resolveForm('charmander', 2, null), { id: 6, name: 'Charizard' });
});

test('resolveForm: a linha do Pichu é Pichu -> Pikachu -> Raichu', () => {
  assert.equal(resolveForm('pichu', 0, null)?.id, 172);
  assert.equal(resolveForm('pichu', 1, null)?.id, 25);
  assert.equal(resolveForm('pichu', 2, null)?.id, 26);
});

test('resolveForm: Eevee SEM pedra permanece Eevee em qualquer estágio', () => {
  assert.equal(resolveForm(EEVEE_LINE_ID, 0, null)?.id, 133);
  assert.equal(resolveForm(EEVEE_LINE_ID, 1, null)?.id, 133);
  assert.equal(resolveForm(EEVEE_LINE_ID, 2, null)?.id, 133);
});

test('resolveForm: Eevee COM pedra vira a eeveelution, e ali fica', () => {
  assert.deepEqual(resolveForm(EEVEE_LINE_ID, 1, 197), { id: 197, name: 'Umbreon' });
  // Estágio acima do teto não muda mais nada.
  assert.deepEqual(resolveForm(EEVEE_LINE_ID, 2, 197), { id: 197, name: 'Umbreon' });
});

test('resolveForm: estágio fora da faixa é limitado, linha inexistente é null', () => {
  assert.equal(resolveForm('charmander', -1, null)?.id, 4);
  assert.equal(resolveForm('charmander', 99, null)?.id, 6);
  assert.equal(resolveForm('missingno', 0, null), null);
});

test('resolveForm: ramo de 2 formas (Wurmple -> Silcoon -> Beautifly)', () => {
  assert.equal(resolveForm('wurmple', 0, null)?.id, 265);
  assert.equal(resolveForm('wurmple', 1, null)?.id, 265);
  assert.equal(resolveForm('wurmple', 1, 266)?.id, 266);
  assert.equal(resolveForm('wurmple', 2, 266)?.id, 267);
  assert.equal(resolveForm('wurmple', 2, 268)?.id, 269);
});

test('findBranch acha o ramo pelo 1º dex id', () => {
  assert.equal(findBranch(eevee, 700)?.[0].name, 'Sylveon');
  assert.equal(findBranch(wurmple, 266)?.length, 2);
  assert.equal(findBranch(wurmple, 267), null);
  assert.equal(findBranch(eevee, 25), null);
  assert.equal(findBranch(charmander, 700), null);
});

test('isValidLineId aceita só o catálogo', () => {
  assert.ok(isValidLineId('bulbasaur'));
  assert.ok(isValidLineId(EEVEE_LINE_ID));
  assert.ok(isValidLineId('tauros'));
  assert.ok(!isValidLineId('missingno'));
  assert.ok(!isValidLineId(''));
});
