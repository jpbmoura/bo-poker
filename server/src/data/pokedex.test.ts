import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EEVEE_LINE_ID,
  EVOLUTION_LINES,
  MAX_POKEMON_PER_USER,
  XP_THRESHOLDS,
  derivedStage,
  findBranch,
  findLine,
  isValidLineId,
  maxStage,
  nextThreshold,
  resolveForm,
  spriteUrl,
  stageFor,
} from './pokedex.js';

const eevee = findLine(EEVEE_LINE_ID)!;
const charmander = findLine('charmander')!;
const pichu = findLine('pichu')!;

test('catálogo: 29 linhas, 3 iniciais por geração + 2 curingas', () => {
  assert.equal(EVOLUTION_LINES.length, 29);
  for (let gen = 1; gen <= 9; gen++) {
    const lines = EVOLUTION_LINES.filter((l) => l.gen === gen);
    assert.equal(lines.length, 3, `geração ${gen} deveria ter 3 iniciais`);
  }
  assert.equal(EVOLUTION_LINES.filter((l) => l.gen === 0).length, 2);
});

test('catálogo: slugs únicos', () => {
  const ids = EVOLUTION_LINES.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('catálogo: toda linha tem 3 estágios, exceto a do Eevee', () => {
  for (const line of EVOLUTION_LINES) {
    if (line.id === EEVEE_LINE_ID) {
      assert.equal(line.stages.length, 1);
    } else {
      assert.equal(line.stages.length, 3, `${line.id} deveria ter 3 estágios`);
    }
  }
});

test('catálogo: branches só existem no Eevee, e são 8', () => {
  for (const line of EVOLUTION_LINES) {
    if (line.id === EEVEE_LINE_ID) {
      assert.equal(line.branches?.length, 8);
    } else {
      assert.equal(line.branches, undefined, `${line.id} não deveria ter branches`);
    }
  }
});

test('catálogo: ids da dex são únicos e plausíveis, nomes não são vazios', () => {
  const seen = new Set<number>();
  for (const line of EVOLUTION_LINES) {
    for (const form of [...line.stages, ...(line.branches ?? [])]) {
      assert.ok(!seen.has(form.id), `id ${form.id} (${form.name}) duplicado`);
      seen.add(form.id);
      assert.ok(form.id >= 1 && form.id <= 1025, `id ${form.id} fora da faixa`);
      assert.ok(form.name.length > 0);
    }
  }
  // 28 linhas de 3 estágios + Eevee (1 estágio + 8 branches).
  assert.equal(seen.size, 28 * 3 + 9);
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

test('maxStage: 2 nas linhas normais, 1 na do Eevee', () => {
  assert.equal(maxStage(charmander), 2);
  assert.equal(maxStage(pichu), 2);
  assert.equal(maxStage(eevee), 1);
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
  assert.equal(resolveForm('tauros', 0, null), null);
});

test('findBranch aceita só as 8 eeveelutions', () => {
  assert.equal(findBranch(eevee, 700)?.name, 'Sylveon');
  assert.equal(findBranch(eevee, 25), null);
  assert.equal(findBranch(charmander, 700), null);
});

test('isValidLineId aceita só o catálogo', () => {
  assert.ok(isValidLineId('bulbasaur'));
  assert.ok(isValidLineId(EEVEE_LINE_ID));
  assert.ok(!isValidLineId('tauros'));
  assert.ok(!isValidLineId(''));
});

test('o teto de Pokémon por conta é 1 hoje', () => {
  assert.equal(MAX_POKEMON_PER_USER, 1);
});
