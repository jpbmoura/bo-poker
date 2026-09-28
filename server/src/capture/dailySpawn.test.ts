import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPAWN_WEIGHT, TIERS, WILD_MAX_DEX, findLine, type Tier } from '../data/pokedex.js';
import { dayKey, isDayKey, nextReset, spawnFor } from './dailySpawn.js';

test('dayKey vira à meia-noite de São Paulo (03:00 UTC)', () => {
  assert.equal(dayKey(new Date('2026-09-28T02:59:59Z')), '2026-09-27');
  assert.equal(dayKey(new Date('2026-09-28T03:00:00Z')), '2026-09-28');
});

test('nextReset é a próxima meia-noite de São Paulo', () => {
  assert.equal(nextReset(new Date('2026-09-28T02:59:59Z')).toISOString(), '2026-09-28T03:00:00.000Z');
  assert.equal(nextReset(new Date('2026-09-28T03:00:00Z')).toISOString(), '2026-09-29T03:00:00.000Z');
  assert.equal(nextReset(new Date('2026-12-31T20:00:00Z')).toISOString(), '2027-01-01T03:00:00.000Z');
});

test('isDayKey só aceita YYYY-MM-DD', () => {
  assert.ok(isDayKey('2026-09-28'));
  assert.ok(!isDayKey('28/09/2026'));
  assert.ok(!isDayKey(20260928));
});

test('spawnFor é determinístico por dia e muda com o sal', () => {
  assert.deepEqual(spawnFor('2026-09-28'), spawnFor('2026-09-28'));
  const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const plain = days.map((d) => spawnFor(d).entry.id).join();
  const salted = days.map((d) => spawnFor(d, 'segredo').entry.id).join();
  assert.notEqual(plain, salted);
});

test('spawnFor devolve sempre uma espécie válida da natureza', () => {
  for (let i = 0; i < 500; i++) {
    const s = spawnFor(`dia-${i}`);
    assert.ok(s.entry.id >= 1 && s.entry.id <= WILD_MAX_DEX);
    assert.ok(findLine(s.lineId));
  }
});

test('spawnFor: distribuição de tiers segue os pesos', () => {
  const n = 20_000;
  const counts = new Map<Tier, number>();
  for (let i = 0; i < n; i++) {
    const t = spawnFor(`d${i}`).tier;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const total = TIERS.reduce((sum, t) => sum + SPAWN_WEIGHT[t], 0);
  for (const t of TIERS) {
    const expected = SPAWN_WEIGHT[t] / total;
    const got = (counts.get(t) ?? 0) / n;
    assert.ok(Math.abs(got - expected) < 0.02, `${t}: ${got} vs ${expected}`);
  }
});
