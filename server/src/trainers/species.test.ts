import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateTarget, formAt, isPendingChoice, liveStage, progressAt } from './species.js';
import type { OwnedPokemon } from './species.js';

const owned = (over: Partial<OwnedPokemon> = {}): OwnedPokemon => ({
  id: 'pk1',
  lineId: 'charmander',
  branchId: null,
  xp: 0,
  ...over,
});

test('liveStage segue os limiares', () => {
  assert.equal(liveStage(owned({ xp: 0 })), 0);
  assert.equal(liveStage(owned({ xp: 250 })), 1);
  assert.equal(liveStage(owned({ xp: 650 })), 2);
});

test('liveStage do Eevee trava em 1: o 3º limiar é no-op ali', () => {
  assert.equal(liveStage(owned({ lineId: 'eevee', xp: 650 })), 1);
});

test('formAt devolve a espécie com o sprite montado', () => {
  assert.deepEqual(formAt(owned(), 0, null), {
    id: 4,
    name: 'Charmander',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',
  });
  assert.equal(formAt(owned(), 2, null)?.name, 'Charizard');
});

test('formAt aceita um estágio ADIADO, diferente do derivado do XP', () => {
  // XP já é de estágio 2, mas a mesa ainda mostra o estágio 1.
  const p = owned({ xp: 650 });
  assert.equal(liveStage(p), 2);
  assert.equal(formAt(p, 1, null)?.name, 'Charmeleon');
});

test('Eevee sem pedra permanece Eevee, com pendingChoice ligado', () => {
  const p = owned({ lineId: 'eevee', xp: 250 });
  assert.equal(isPendingChoice(p), true);
  assert.equal(formAt(p, 1, null)?.id, 133);
});

test('Eevee com pedra vira a eeveelution e sai do pendente', () => {
  const p = owned({ lineId: 'eevee', xp: 250, branchId: 197 });
  assert.equal(isPendingChoice(p), false);
  assert.equal(formAt(p, 1, 197)?.name, 'Umbreon');
});

test('Eevee antes do limiar não está pendente', () => {
  assert.equal(isPendingChoice(owned({ lineId: 'eevee', xp: 10 })), false);
});

test('progressAt leva o XP VIVO e o estágio EXIBIDO', () => {
  const p = owned({ xp: 260 });
  assert.deepEqual(progressAt(p, 0), {
    pokemonId: 'pk1',
    lineId: 'charmander',
    stage: 0,
    maxStage: 2,
    xp: 260,
    nextXp: 650,
    pendingChoice: false,
  });
});

test('progressAt no estágio final não tem próximo limiar', () => {
  assert.equal(progressAt(owned({ xp: 700 }), 2)?.nextXp, null);
  assert.equal(progressAt(owned({ lineId: 'eevee', xp: 300, branchId: 134 }), 1)?.nextXp, null);
});

test('qualquer linha ramificada fica pendente no ponto do ramo', () => {
  // Wurmple ramifica já no 1º limiar; Oddish só no 2º.
  assert.equal(isPendingChoice(owned({ lineId: 'wurmple', xp: 250 })), true);
  assert.equal(isPendingChoice(owned({ lineId: 'wurmple', xp: 250, branchId: 266 })), false);
  assert.equal(isPendingChoice(owned({ lineId: 'oddish', xp: 250 })), false);
  assert.equal(isPendingChoice(owned({ lineId: 'oddish', xp: 650 })), true);
  assert.equal(formAt(owned({ lineId: 'oddish', xp: 650 }), 2, null)?.name, 'Gloom');
});

test('linha linear nunca fica pendente', () => {
  assert.equal(isPendingChoice(owned({ xp: 10_000 })), false);
  assert.equal(isPendingChoice(owned({ lineId: 'tauros', xp: 10_000 })), false);
});

test('linha desconhecida devolve null em vez de explodir', () => {
  assert.equal(formAt(owned({ lineId: 'missingno' }), 0, null), null);
  assert.equal(progressAt(owned({ lineId: 'missingno' }), 0), null);
});

test('duplicateTarget: linha possuída recebe o XP', () => {
  const mine = owned({ id: 'pk1', lineId: 'charmander' });
  assert.equal(duplicateTarget([owned({ id: 'pk0', lineId: 'pichu' }), mine], 'charmander'), mine);
});

test('duplicateTarget: linha não possuída é captura nova', () => {
  assert.equal(duplicateTarget([owned({ lineId: 'pichu' })], 'charmander'), null);
});

test('duplicateTarget: Eevee sem pedra absorve o repetido', () => {
  const eevee = owned({ lineId: 'eevee', xp: 100 });
  assert.equal(duplicateTarget([eevee], 'eevee'), eevee);
});

test('duplicateTarget: com todos os Eevees evoluídos, captura um novo', () => {
  const pokemon = [owned({ id: 'a', lineId: 'eevee', xp: 250, branchId: 197 })];
  assert.equal(duplicateTarget(pokemon, 'eevee'), null);
});

test('duplicateTarget: entre Eevees, o sem pedra é o alvo', () => {
  const pending = owned({ id: 'b', lineId: 'eevee', xp: 10 });
  const pokemon = [owned({ id: 'a', lineId: 'eevee', xp: 250, branchId: 134 }), pending];
  assert.equal(duplicateTarget(pokemon, 'eevee'), pending);
});
