import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WILD_MAX_DEX, normalizeName } from '../data/pokedex.js';
import { spawnFor } from '../capture/dailySpawn.js';
import { guessFor } from './dailyGuess.js';

test('guessFor é determinístico por dia e muda com o sal', () => {
  assert.deepEqual(guessFor('2026-09-28'), guessFor('2026-09-28'));
  const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const plain = days.map((d) => guessFor(d).entry.id).join();
  const salted = days.map((d) => guessFor(d, 'segredo').entry.id).join();
  assert.notEqual(plain, salted);
});

test('guessFor devolve sempre uma espécie da natureza', () => {
  for (let i = 0; i < 500; i++) {
    const id = guessFor(`dia-${i}`).entry.id;
    assert.ok(id >= 1 && id <= WILD_MAX_DEX);
  }
});

test('guessFor não segue o sorteio da captura', () => {
  const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const same = days.filter((d) => guessFor(d).entry.id === spawnFor(d).entry.id);
  assert.ok(same.length < 5);
});

test('normalizeName ignora caixa, acento e pontuação, mas separa os Nidoran', () => {
  assert.equal(normalizeName('Mr. Mime'), normalizeName('mr mime'));
  assert.equal(normalizeName('Farfetch’d'), 'farfetchd');
  assert.equal(normalizeName('Ho-Oh'), 'hooh');
  assert.equal(normalizeName('Flabébé'), 'flabebe');
  assert.notEqual(normalizeName('Nidoran♀'), normalizeName('Nidoran♂'));
});
