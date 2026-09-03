import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManagerImpl } from './RoomManager.js';
import {
  normalizeRoomId,
  normalizeRoomName,
  ROOM_NAME_MAX_LENGTH,
} from '../types/index.js';
import type { PokemonState } from '../trainers/trainerCache.js';

const TRAINER: PokemonState = {
  id: 'pk1',
  lineId: 'charmander',
  branchId: null,
  xp: 0,
  isActive: true,
  pendingXp: 0,
};
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
    userId: 'bob',
    name: 'Bob',
    login: 'bob',
    trainer: TRAINER,
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
      userId: name.toLowerCase(),
      name,
      login: name.toLowerCase(),
      trainer: TRAINER,
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
    userId: 'bob',
    name: 'Bob',
    login: 'bob',
    trainer: TRAINER,
    role: 'voter',
    now: T0,
  });
  // Votou: a graca nao o alcanca, entao so o TTL da sala resolve.
  room.setVote(created.player.id, '5');
  room.unbindSocket('s1', T0);

  assert.equal(manager.sweep(T0 + 60_000, 45_000, 3_600_000).removedRooms, 0);
  assert.equal(manager.sweep(T0 + 3_700_000, 45_000, 3_600_000).removedRooms, 1);
});

test('getOrCreate hidrata os metadados na PRIMEIRA materializacao', () => {
  const manager = new RoomManagerImpl();
  const room = manager.getOrCreate('SALA', { name: 'Squad', ownerId: 'u1' });
  assert.equal(room?.name, 'Squad');
  assert.equal(room?.ownerId, 'u1');
});

test('sala ja viva ignora meta novo: quem esta dentro nao pode ter o dono trocado', () => {
  const manager = new RoomManagerImpl();
  manager.getOrCreate('SALA', { name: 'Squad', ownerId: 'u1' });
  const again = manager.getOrCreate('SALA', { name: 'Outro', ownerId: 'u2' });
  assert.equal(again?.name, 'Squad');
  assert.equal(again?.ownerId, 'u1');
});

test('getOrCreate sem meta continua valido (caminho dos testes e do legado)', () => {
  const manager = new RoomManagerImpl();
  const room = manager.getOrCreate('SALA');
  assert.equal(room?.name, 'SALA');
  assert.equal(room?.ownerId, null);
});

test('normalizeRoomName colapsa espacos e corta no limite', () => {
  assert.equal(normalizeRoomName('  Squad   BackOffice  '), 'Squad BackOffice');
  assert.equal(normalizeRoomName(''), '');
  assert.equal(normalizeRoomName('x'.repeat(80)).length, ROOM_NAME_MAX_LENGTH);
});
