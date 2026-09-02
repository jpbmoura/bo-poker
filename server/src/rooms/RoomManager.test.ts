import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManagerImpl } from './RoomManager.js';
import { normalizeRoomId } from '../types/index.js';
import type { Pokemon } from '../types/index.js';

const POKE: Pokemon = { id: 25, name: 'pikachu', sprite: 'p.png' };
const T0 = 1_000_000;

test('normalizeRoomId canonicaliza e rejeita o invalido', () => {
  assert.equal(normalizeRoomId('abc'), 'ABC');
  assert.equal(normalizeRoomId('  bo-poker 42 '), 'BOPOKER42');
  assert.equal(normalizeRoomId('SMOKE1'), 'SMOKE1');
  assert.equal(normalizeRoomId('smoke-1'), 'SMOKE1');
  assert.equal(normalizeRoomId(''), null);
  assert.equal(normalizeRoomId('---'), null);
  assert.equal(normalizeRoomId('A'.repeat(21)), null);
});

test('salas com grafias diferentes sao a mesma sala', () => {
  const manager = new RoomManagerImpl();
  const a = manager.getOrCreate('smoke-1');
  const b = manager.getOrCreate('SMOKE1');
  assert.ok(a);
  assert.equal(a, b);
  assert.equal(manager.size(), 1);
  assert.equal(manager.get('  smoke1  '), a);
});

test('id invalido nao cria sala', () => {
  const manager = new RoomManagerImpl();
  assert.equal(manager.getOrCreate('///'), undefined);
  assert.equal(manager.size(), 0);
});

test('sweep remove offline vencido e apaga a sala que esvaziou', () => {
  const manager = new RoomManagerImpl();
  const room = manager.getOrCreate('SALA');
  assert.ok(room);
  room.upsertPlayer({
    identityKey: 'user:bob',
    socketId: 's1',
    name: 'Bob',
    login: 'bob',
    pokemon: POKE,
    role: 'voter',
    now: T0,
  });
  room.unbindSocket('s1', T0);

  const early = manager.sweep(T0 + 1_000, 45_000, 2 * 60 * 60 * 1000);
  assert.equal(early.removedRooms, 0);
  assert.equal(manager.size(), 1);

  const late = manager.sweep(T0 + 46_000, 45_000, 2 * 60 * 60 * 1000);
  assert.equal(late.removedRooms, 1, 'sala vazia some na hora, sem esperar o TTL');
  assert.equal(manager.size(), 0);
});

test('sweep devolve as salas que mudaram mas continuam vivas', () => {
  const manager = new RoomManagerImpl();
  const room = manager.getOrCreate('SALA');
  assert.ok(room);
  for (const [name, socketId] of [['Alice', 's1'], ['Bob', 's2']] as const) {
    room.upsertPlayer({
      identityKey: `user:${name.toLowerCase()}`,
      socketId,
      name,
      login: name.toLowerCase(),
      pokemon: POKE,
      role: 'voter',
      now: T0,
    });
  }
  room.unbindSocket('s2', T0);

  const result = manager.sweep(T0 + 46_000, 45_000, 2 * 60 * 60 * 1000);
  assert.equal(result.removedRooms, 0);
  assert.deepEqual(result.changed, [room]);
  assert.equal(room.allPlayers().length, 1);
});

test('sala com todo mundo offline e apagada ao vencer o TTL', () => {
  const manager = new RoomManagerImpl();
  const room = manager.getOrCreate('SALA');
  assert.ok(room);
  const created = room.upsertPlayer({
    identityKey: 'user:bob',
    socketId: 's1',
    name: 'Bob',
    login: 'bob',
    pokemon: POKE,
    role: 'voter',
    now: T0,
  });
  // Votou: a graca nao o alcanca, entao so o TTL da sala resolve.
  room.setVote(created.player.id, '5');
  room.unbindSocket('s1', T0);

  assert.equal(manager.sweep(T0 + 60_000, 45_000, 3_600_000).removedRooms, 0);
  assert.equal(manager.sweep(T0 + 3_700_000, 45_000, 3_600_000).removedRooms, 1);
});
