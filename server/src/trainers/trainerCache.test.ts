import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainerCacheImpl, type TrainerStorePort } from './trainerCache.js';
import type { PokemonRecord } from './trainerStore.js';

const row = (over: Partial<PokemonRecord> = {}): PokemonRecord => ({
  id: 'pk1',
  userId: 'u1',
  lineId: 'charmander',
  branchId: null,
  xp: 0,
  isActive: true,
  ...over,
});

class FakeStore implements TrainerStorePort {
  rows: PokemonRecord[] = [];
  listCalls = 0;
  addCalls: Array<{ id: string; delta: number }> = [];
  failList = false;
  failAdd = false;
  /** Roda dentro do addXp, antes de resolver — para simular corrida no flush. */
  onAdd?: () => void;

  async listByUser(userId: string): Promise<PokemonRecord[]> {
    this.listCalls++;
    if (this.failList) throw new Error('db down');
    return this.rows.filter((r) => r.userId === userId);
  }

  async addXp(id: string, delta: number): Promise<void> {
    this.onAdd?.();
    if (this.failAdd) throw new Error('db down');
    this.addCalls.push({ id, delta });
  }
}

function setup() {
  const store = new FakeStore();
  return { store, cache: new TrainerCacheImpl(store) };
}

test('peek nunca toca o banco', async () => {
  const { store, cache } = setup();
  assert.equal(cache.peek('u1'), null);
  assert.equal(store.listCalls, 0);
});

test('resolve lê uma vez e nunca mais: memória é a fonte da verdade', async () => {
  const { store, cache } = setup();
  store.rows = [row({ xp: 120 })];

  const first = await cache.resolve('u1');
  assert.equal(first.pokemon.length, 1);
  assert.equal(first.pokemon[0].xp, 120);
  assert.equal(store.listCalls, 1);

  await cache.resolve('u1');
  assert.equal(store.listCalls, 1, 'não pode reler o banco depois de resolvido');
});

test('leitura falhando devolve estado degradado em vez de lançar', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  store.failList = true;

  const state = await cache.resolve('u1');
  assert.deepEqual(state.pokemon, [], 'degradado = coleção vazia');

  // Degradado NÃO é verdade: a próxima chamada tenta de novo.
  store.failList = false;
  const healed = await cache.resolve('u1');
  assert.equal(healed.pokemon.length, 1);
  assert.equal(store.listCalls, 2);
});

test('reconcile cura os degradados e diz quem curou', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  store.failList = true;
  await cache.resolve('u1');

  assert.deepEqual(await cache.reconcile(), [], 'banco ainda fora: nada cura');

  store.failList = false;
  assert.deepEqual(await cache.reconcile(), ['u1']);
  assert.equal(cache.peek('u1')?.pokemon.length, 1);

  assert.deepEqual(await cache.reconcile(), [], 'já resolvido não é revisitado');
});

test('applyXp credita no ativo e devolve antes/depois', async () => {
  const { store, cache } = setup();
  store.rows = [row({ xp: 240 })];
  await cache.resolve('u1');

  const result = cache.applyXp('u1', 20);
  assert.ok(result);
  assert.equal(result.before.xp, 240);
  assert.equal(result.after.xp, 260);
  assert.equal(cache.peek('u1')?.pokemon[0].xp, 260);
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 20);
  assert.equal(store.addCalls.length, 0, 'applyXp não pode esperar o banco');
});

test('applyXp devolve null sem Pokémon (nunca escolheu ou leitura degradada)', async () => {
  const { cache } = setup();
  await cache.resolve('u1');
  assert.equal(cache.applyXp('u1', 10), null);
});

test('flush grava o delta pendente e o zera', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  await cache.resolve('u1');
  cache.applyXp('u1', 8);
  cache.applyXp('u1', 7);

  assert.equal(await cache.flush(), 1);
  assert.deepEqual(store.addCalls, [{ id: 'pk1', delta: 15 }]);
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 0);

  assert.equal(await cache.flush(), 0, 'nada pendente, nada a gravar');
});

test('falha de escrita mantém o pendente para o próximo ciclo', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  await cache.resolve('u1');
  cache.applyXp('u1', 10);

  store.failAdd = true;
  await cache.flush();
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 10, 'não pode perder XP');
  assert.equal(cache.peek('u1')?.pokemon[0].xp, 10, 'memória segue adiantada');

  store.failAdd = false;
  await cache.flush();
  assert.deepEqual(store.addCalls, [{ id: 'pk1', delta: 10 }]);
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 0);
});

test('XP creditado durante o flush em voo sobrevive', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  await cache.resolve('u1');
  cache.applyXp('u1', 10);

  // Chega um award no meio do await do banco.
  store.onAdd = () => {
    cache.applyXp('u1', 5);
    store.onAdd = undefined;
  };
  await cache.flush();

  assert.deepEqual(store.addCalls, [{ id: 'pk1', delta: 10 }]);
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 5, 'o delta novo não some');
  assert.equal(cache.peek('u1')?.pokemon[0].xp, 15);
});

test('put reflete um registro já confirmado e preserva o pendente', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  await cache.resolve('u1');
  cache.applyXp('u1', 9);

  cache.put('u1', row({ xp: 9, branchId: null, lineId: 'charmander' }));
  assert.equal(cache.peek('u1')?.pokemon[0].pendingXp, 9, 'o flush ainda não rodou');
});

test('put num usuário frio cria a coleção', async () => {
  const { cache } = setup();
  const state = cache.put('u9', row({ id: 'pk9', userId: 'u9' }));
  assert.equal(state.id, 'pk9');
  assert.equal(cache.peek('u9')?.pokemon.length, 1);
});

// --- A estrutura multi-Pokémon, exercitada de verdade ------------------------
// A API REST hoje trava em 1, mas o cache não sabe disso. Estes casos garantem
// que a coleção não está só "escrita para parecer pronta".

test('com dois Pokémon, applyXp mexe SÓ no ativo', async () => {
  const { store, cache } = setup();
  store.rows = [
    row({ id: 'pk1', isActive: true, xp: 100 }),
    row({ id: 'pk2', isActive: false, xp: 50, lineId: 'eevee' }),
  ];
  await cache.resolve('u1');

  cache.applyXp('u1', 10);
  const state = cache.peek('u1')!;
  assert.equal(state.pokemon.find((p) => p.id === 'pk1')?.xp, 110);
  assert.equal(state.pokemon.find((p) => p.id === 'pk2')?.xp, 50);
});

test('put com isActive desliga o ativo anterior', async () => {
  const { store, cache } = setup();
  store.rows = [
    row({ id: 'pk1', isActive: true }),
    row({ id: 'pk2', isActive: false, lineId: 'eevee' }),
  ];
  await cache.resolve('u1');

  cache.put('u1', row({ id: 'pk2', isActive: true, lineId: 'eevee' }));
  const state = cache.peek('u1')!;
  assert.equal(state.pokemon.find((p) => p.id === 'pk1')?.isActive, false);
  assert.equal(state.pokemon.find((p) => p.id === 'pk2')?.isActive, true);
  assert.equal(cache.activePokemon(state)?.id, 'pk2');
});

test('drop remove e promove outro a ativo', async () => {
  const { store, cache } = setup();
  store.rows = [
    row({ id: 'pk1', isActive: true }),
    row({ id: 'pk2', isActive: false, lineId: 'eevee' }),
  ];
  await cache.resolve('u1');

  cache.drop('u1', 'pk1');
  const state = cache.peek('u1')!;
  assert.equal(state.pokemon.length, 1);
  assert.equal(cache.activePokemon(state)?.id, 'pk2');
});

test('liberar o único deixa a coleção vazia', async () => {
  const { store, cache } = setup();
  store.rows = [row()];
  await cache.resolve('u1');

  cache.drop('u1', 'pk1');
  assert.deepEqual(cache.peek('u1')?.pokemon, []);
  assert.equal(cache.activePokemon(cache.peek('u1')!), null);
});

test('flush grava cada Pokémon da coleção separadamente', async () => {
  const { store, cache } = setup();
  store.rows = [
    row({ id: 'pk1', isActive: true }),
    row({ id: 'pk2', isActive: false, lineId: 'eevee' }),
  ];
  await cache.resolve('u1');
  cache.applyXp('u1', 12);
  // Sujar o segundo à mão: só o ativo recebe XP hoje.
  cache.peek('u1')!.pokemon[1].pendingXp = 3;

  assert.equal(await cache.flush(), 2);
  assert.deepEqual(store.addCalls.map((c) => c.id).sort(), ['pk1', 'pk2']);
});
