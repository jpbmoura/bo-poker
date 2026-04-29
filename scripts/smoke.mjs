import { io } from 'socket.io-client';

const URL = process.env.URL || 'http://localhost:3001';
const ROOM = 'SMOKE-' + Math.floor(Math.random() * 100000);

const samplePokemon = (name, id) => ({
  id,
  name,
  sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
});

function makeClient(name, role = 'voter', pokeId = 1) {
  const socket = io(URL, { transports: ['websocket'] });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      socket.emit('room:join', {
        roomId: ROOM,
        name,
        role,
        pokemon: samplePokemon(name.toLowerCase(), pokeId),
      });
    });
    socket.on('room:joined', ({ playerId }) => {
      resolve({ socket, playerId });
    });
    socket.on('room:error', (err) => reject(new Error(err.message)));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('join timeout')), 4000);
  });
}

const expect = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  } else {
    console.log('PASS:', msg);
  }
};

(async () => {
  const a = await makeClient('Alice', 'voter', 25);
  const b = await makeClient('Bob', 'voter', 6);
  const c = await makeClient('Carol', 'spectator', 1);

  let lastA;
  a.socket.on('room:state', (s) => (lastA = s));

  // Vote
  a.socket.emit('vote:cast', { value: '5' });
  b.socket.emit('vote:cast', { value: '5' });
  await new Promise((r) => setTimeout(r, 200));

  expect(lastA.players.length === 3, 'three players in room');
  expect(
    lastA.players.find((p) => p.id === a.playerId).vote === 'HIDDEN',
    'votes are hidden before reveal',
  );

  a.socket.emit('vote:reveal');
  await new Promise((r) => setTimeout(r, 200));

  expect(lastA.revealed === true, 'reveal flag set');
  expect(
    lastA.players.find((p) => p.id === a.playerId).vote === '5',
    'real value visible after reveal',
  );
  expect(
    lastA.players.find((p) => p.id === c.playerId).role === 'spectator',
    'spectator role preserved',
  );
  expect(
    lastA.players.find((p) => p.id === c.playerId).vote === null,
    'spectator never has a vote',
  );

  // Disconnect Bob
  b.socket.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  expect(
    lastA.players.find((p) => p.id === b.playerId).online === false,
    'disconnected player marked offline (not removed)',
  );

  a.socket.disconnect();
  c.socket.disconnect();
  console.log('\nALL SMOKE TESTS PASSED');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
