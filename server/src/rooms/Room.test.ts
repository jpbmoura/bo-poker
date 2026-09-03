import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from './Room.js';
import type { PokemonState } from '../trainers/trainerCache.js';

/** Um treinador de teste. O estágio exibido é derivado daqui pelo próprio Room. */
const trainerAt = (xp = 0, over: Partial<PokemonState> = {}): PokemonState => ({
  id: 'pk1',
  lineId: 'charmander',
  branchId: null,
  xp,
  isActive: true,
  pendingXp: 0,
  ...over,
});

const T0 = 1_000_000;

/** A identidade é sempre a do usuário autenticado, nunca o nome. */
function join(
  room: Room,
  name: string,
  socketId: string,
  extra: {
    now?: number;
    role?: 'voter' | 'spectator';
    userId?: string;
    login?: string | null;
    trainer?: PokemonState | null;
  } = {},
) {
  const userId = extra.userId ?? name.toLowerCase();
  return room.upsertPlayer({
    identityKey: `user:${userId}`,
    socketId,
    userId,
    name,
    login: extra.login ?? name.toLowerCase(),
    trainer: extra.trainer === undefined ? trainerAt() : extra.trainer,
    role: extra.role ?? 'voter',
    now: extra.now ?? T0,
  });
}

test('join novo cria um assento', () => {
  const room = new Room('SALA');
  const r = join(room, 'Alice', 's1');
  assert.equal(r.rebound, false);
  assert.equal(room.allPlayers().length, 1);
});

test('reconexao depois do disconnect religa o mesmo assento e preserva o voto', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');
  room.setVote(first.player.id, '5');

  room.unbindSocket('s1', T0 + 1000);
  assert.equal(room.getPlayer(first.player.id)?.online, false);

  const again = join(room, 'Alice', 's2', { now: T0 + 2000 });
  assert.equal(again.rebound, true, 'deve religar, nao criar assento novo');
  assert.equal(again.player.id, first.player.id);
  assert.equal(again.player.vote, '5', 'voto preservado');
  assert.equal(again.player.joinedAt, T0, 'joinedAt preservado');
  assert.equal(room.allPlayers().length, 1, 'sem duplicata');
});

test('reconexao ANTES do servidor notar o disconnect religa, sem duplicar', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');

  // socket antigo ainda vivo (o disconnect nao chegou)
  const again = join(room, 'Alice', 's2');
  assert.equal(again.player.id, first.player.id);
  assert.equal(room.allPlayers().length, 1);
});

test('duas pessoas com o mesmo nome de exibicao ocupam assentos distintos', () => {
  const room = new Room('SALA');
  const ana1 = join(room, 'Ana', 's1', { userId: 'gh-1', login: 'ana-dev' });
  const ana2 = join(room, 'Ana', 's2', { userId: 'gh-2', login: 'ana-ops' });

  assert.notEqual(ana1.player.id, ana2.player.id);
  assert.equal(ana2.rebound, false, 'usuario diferente nunca religa assento alheio');
  assert.equal(room.allPlayers().length, 2);
  assert.deepEqual(
    room.allPlayers().map((p) => p.login).sort(),
    ['ana-dev', 'ana-ops'],
    'o handle e o que desambigua na UI',
  );
});

test('religar NAO altera o papel nem apaga o voto em andamento', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');
  room.setVote(first.player.id, '8');

  // Segunda aba mandando 'spectator' do proprio sessionStorage.
  join(room, 'Alice', 's2', { role: 'spectator' });

  assert.equal(room.getPlayer(first.player.id)?.role, 'voter', 'papel do servidor vence');
  assert.equal(room.getPlayer(first.player.id)?.vote, '8', 'voto preservado');
});

test('aba duplicada compartilha o assento e nenhuma derruba a outra', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');
  join(room, 'Alice', 's2');

  assert.equal(room.getPlayer(first.player.id)?.socketIds.size, 2);

  const closed = room.unbindSocket('s1', T0 + 500);
  assert.equal(closed?.wentOffline, false, 'ainda tem uma aba viva');
  assert.equal(room.getPlayer(first.player.id)?.online, true);

  const last = room.unbindSocket('s2', T0 + 600);
  assert.equal(last?.wentOffline, true);
  assert.equal(room.getPlayer(first.player.id)?.online, false);
});

test('setVote recusa rodada revelada, espectador, id desconhecido e valor invalido', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  const carol = join(room, 'Carol', 's2', { role: 'spectator' });

  assert.equal(room.setVote('nao-existe', '5'), false);
  assert.equal(room.setVote(carol.player.id, '5'), false, 'espectador nao vota');
  assert.equal(room.setVote(alice.player.id, '7' as never), false, 'fora da sequencia');
  assert.equal(room.setVote(alice.player.id, '5'), true);

  room.reveal();
  assert.equal(room.setVote(alice.player.id, '8'), false, 'nao muda depois do reveal');
});

test('serializeFor mostra o proprio voto e mascara o dos outros', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  const bob = join(room, 'Bob', 's2');
  room.setVote(alice.player.id, '5');

  const seenByAlice = room.serializeFor(alice.player.id);
  assert.equal(seenByAlice.players.find((p) => p.id === alice.player.id)?.vote, '5');

  const seenByBob = room.serializeFor(bob.player.id);
  assert.equal(seenByBob.players.find((p) => p.id === alice.player.id)?.vote, 'HIDDEN');
  assert.equal(seenByBob.players.find((p) => p.id === bob.player.id)?.vote, null);

  room.reveal();
  assert.equal(
    room.serializeFor(bob.player.id).players.find((p) => p.id === alice.player.id)?.vote,
    '5',
  );
});

test('serializeFor nunca emite estado interno', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  const [serialized] = room.serializeFor(alice.player.id).players;
  assert.deepEqual(
    Object.keys(serialized).sort(),
    ['id', 'joinedAt', 'login', 'name', 'online', 'pokemon', 'progress', 'role', 'vote'],
    'nada de identityKey/socketIds/lastSeenAt no wire',
  );
});

test('reset limpa votos e o flag de revelado', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  room.setVote(alice.player.id, '5');
  room.reveal();

  room.reset();
  assert.equal(room.revealed, false);
  assert.equal(room.getPlayer(alice.player.id)?.vote, null);
});

test('setRole para espectador limpa o voto e e recusado durante o reveal', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  room.setVote(alice.player.id, '5');

  assert.equal(room.setRole(alice.player.id, 'spectator'), true);
  assert.equal(room.getPlayer(alice.player.id)?.vote, null);

  room.reveal();
  assert.equal(room.setRole(alice.player.id, 'voter'), false);
});

test('reapOffline respeita a graca, pula quem esta online e quem ja votou', () => {
  const room = new Room('SALA');
  const alice = join(room, 'Alice', 's1');
  const bob = join(room, 'Bob', 's2');
  const dave = join(room, 'Dave', 's3');

  room.setVote(bob.player.id, '8');
  room.unbindSocket('s2', T0);
  room.unbindSocket('s3', T0);

  assert.deepEqual(room.reapOffline(T0 + 1000, 45_000), [], 'ainda dentro da graca');

  const reaped = room.reapOffline(T0 + 46_000, 45_000);
  assert.deepEqual(reaped, [dave.player.id], 'so o offline que nao votou sai');
  assert.ok(room.getPlayer(bob.player.id), 'quem votou fica ate o fim da rodada');
  assert.ok(room.getPlayer(alice.player.id), 'quem esta online nunca sai');
});

test('quem votou e saiu e removido na varredura seguinte ao reset', () => {
  const room = new Room('SALA');
  const bob = join(room, 'Bob', 's1');
  room.setVote(bob.player.id, '8');
  room.unbindSocket('s1', T0);

  assert.deepEqual(room.reapOffline(T0 + 46_000, 45_000), []);
  room.reset();
  assert.deepEqual(room.reapOffline(T0 + 46_000, 45_000), [bob.player.id]);
});

test('removeInactive ignora quem saiu ha pouco', () => {
  const room = new Room('SALA');
  const bob = join(room, 'Bob', 's1');
  room.unbindSocket('s1', T0);

  assert.deepEqual(room.removeInactive(T0 + 3_000, 10_000), [], 'pode estar reconectando');
  assert.deepEqual(room.removeInactive(T0 + 11_000, 10_000), [bob.player.id]);
});

test('remover um jogador libera o nome para um novo assento', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');
  room.removePlayer(first.player.id);

  const second = join(room, 'Alice', 's2');
  assert.equal(second.rebound, false);
  assert.notEqual(second.player.id, first.player.id);
  assert.equal(room.allPlayers().length, 1);
});

test('getPlayerBySocket acompanha o religamento', () => {
  const room = new Room('SALA');
  const first = join(room, 'Alice', 's1');
  room.unbindSocket('s1', T0);
  assert.equal(room.getPlayerBySocket('s1'), undefined);

  join(room, 'Alice', 's2', { now: T0 + 100 });
  assert.equal(room.getPlayerBySocket('s2')?.id, first.player.id);
});

// --- metadados persistidos: nome e dono ---

test('sem meta, o nome cai no proprio id e nao ha dono', () => {
  const room = new Room('SALA');
  assert.equal(room.name, 'SALA');
  assert.equal(room.ownerId, null);
  assert.equal(room.serializeFor(null).name, 'SALA');
});

test('meta hidrata nome e dono e o nome viaja no estado', () => {
  const room = new Room('SALA', { name: 'Squad BackOffice', ownerId: 'u1' });
  const r = join(room, 'Alice', 's1', { userId: 'u1' });
  assert.equal(room.serializeFor(r.player.id).name, 'Squad BackOffice');
});

test('isOwner e calculado POR ESPECTADOR e o ownerId nao vaza no wire', () => {
  const room = new Room('SALA', { name: 'Squad', ownerId: 'u1' });
  const dono = join(room, 'Alice', 's1', { userId: 'u1' });
  const outro = join(room, 'Bob', 's2', { userId: 'u2' });

  assert.equal(room.serializeFor(dono.player.id).isOwner, true);
  assert.equal(room.serializeFor(outro.player.id).isOwner, false);

  // O id do dono nao pode aparecer em lugar nenhum do payload: o estado vai
  // para TODA a mesa.
  assert.equal(JSON.stringify(room.serializeFor(outro.player.id)).includes('u1'), false);
});

test('sala sem dono nunca reporta isOwner', () => {
  const room = new Room('SALA');
  const r = join(room, 'Alice', 's1', { userId: 'u1' });
  assert.equal(room.serializeFor(r.player.id).isOwner, false);
});

test('espectador desconhecido nao e dono', () => {
  const room = new Room('SALA', { name: 'Squad', ownerId: 'u1' });
  join(room, 'Alice', 's1', { userId: 'u1' });
  assert.equal(room.serializeFor('id-que-nao-existe').isOwner, false);
});
