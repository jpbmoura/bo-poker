import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getForcedPokemon, matchesArthur, TAUROS } from './forcedPokemon.js';

const POSITIVES = [
  'Arthur',
  'arthur',
  'ARTHUR',
  '  Arthur  ',
  'Artur',
  'Árthur',
  'Ãrtur',
  'Arthür',
  'Arthuro',
  'Arthurito',
  'Arthurzinho',
  'Arthurzão',
  'Arrrrthuuur',
  'Artttur',
  'A r t h u r',
  'A.R.T.H.U.R',
  'Arthur123',
  'Arthur_',
  'Arthur Henrique',
  'O Arthur',
  '4rthur',
  '@rthur',
  '4rthur5',
  'aRtHuR',
  'ZArthur',
  'Carthur',
];

const NEGATIVES = [
  '',
  ' ',
  'Marta',
  'Martha',
  'Bartholomeu',
  'Bartholomew',
  'Aurora',
  'Maria',
  'João',
  'Pedro',
  'Art',
  'Arthr',
  'Author',
  'Authur',
];

for (const name of POSITIVES) {
  test(`matchesArthur reconhece variação: "${name}"`, () => {
    assert.equal(matchesArthur(name), true);
    assert.deepEqual(getForcedPokemon(name), TAUROS);
  });
}

for (const name of NEGATIVES) {
  test(`matchesArthur rejeita: "${name}"`, () => {
    assert.equal(matchesArthur(name), false);
    assert.equal(getForcedPokemon(name), null);
  });
}
