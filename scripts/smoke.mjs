import { io } from 'socket.io-client';

const URL = process.env.URL || 'http://localhost:3001';
let ROOM;
let ROOM2;

// O servidor precisa rodar com a graca curta, senao o cenario de remocao
// levaria 45s:
//   PLAYER_GRACE_MS=1500 PLAYER_SWEEP_INTERVAL_MS=250 pnpm dev:server
const GRACE_MS = Number(process.env.PLAYER_GRACE_MS) || 1500;

/**
 * O socket exige sessao no handshake, entao cada cliente precisa de um cookie
 * real. Inserir linhas no Postgres nao serviria: o cookie de sessao e assinado
 * com o secret. Aqui usamos a API HTTP de verdade — o sign-in por e-mail/senha
 * existe so fora de producao (ENABLE_DEV_PASSWORD_AUTH=true).
 */
async function signUp(label) {
  const email = `smoke-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.local`;
  const res = await fetch(`${URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // O Better Auth recusa requisicao sem Origin (protecao CSRF); o fetch do
      // Node nao manda um sozinho.
      Origin: URL,
    },
    body: JSON.stringify({ email, password: 'senha-de-teste-123', name: label }),
  });
  if (!res.ok) {
    throw new Error(`sign-up de ${label} falhou (${res.status}): ${await res.text()}`);
  }
  // getSetCookie() e obrigatorio: headers.get('set-cookie') junta multiplos
  // headers com ", " e o atributo Expires contem virgula, corrompendo o valor.
  const cookies = res.headers.getSetCookie();
  if (!cookies?.length) throw new Error(`sign-up de ${label} nao devolveu cookie`);
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Sala agora PRECISA existir no banco para ser jogavel, entao o smoke cria a
 * dele pela API real. O header Origin e obrigatorio duas vezes: pela protecao
 * de CSRF do Better Auth e pelo requireTrustedOrigin do router de salas.
 */
async function apiCreateRoom(cookie, name) {
  const res = await fetch(`${URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL, Cookie: cookie },
    body: JSON.stringify({ name: name ?? '' }),
  });
  if (!res.ok) {
    throw new Error(`criacao de sala falhou (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function api(method, path, cookie, body) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: URL, Cookie: cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const samplePokemon = (name, id) => ({
  id,
  name,
  sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(name, opts = {}) {
  const { role = 'voter', pokeId = 1, room = ROOM, cookie } = opts;
  const socket = io(URL, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
  });
  const client = { socket, name, playerId: null, state: null, lastError: null };
  socket.on('room:state', (s) => (client.state = s));
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      socket.emit('room:join', {
        roomId: room,
        name,
        role,
        pokemon: samplePokemon(name.toLowerCase(), pokeId),
      });
    };
    const onJoinError = (err) =>
      reject(new Error(`${name}: ${err.code} ${err.message}`));

    socket.on('connect', onConnect);
    socket.on('room:error', onJoinError);
    socket.on('connect_error', reject);

    socket.on('room:joined', ({ playerId }) => {
      client.playerId = playerId;
      // O app real re-entra sozinho no `connect`; aqui desligamos isso para o
      // teste controlar exatamente quando cada join acontece.
      socket.off('connect', onConnect);
      socket.off('room:error', onJoinError);
      socket.on('room:error', (err) => (client.lastError = err));
      resolve(client);
    });

    setTimeout(() => reject(new Error(`${name}: join timeout`)), 4000);
  });
}

/** Socket sem cookie: deve ser recusado ainda no handshake. */
function expectUnauthenticated() {
  const socket = io(URL, { transports: ['websocket'], reconnection: false });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => reject(new Error('conectou sem sessao')));
    socket.on('connect_error', (err) => resolve({ socket, err }));
    setTimeout(() => reject(new Error('nenhum connect_error recebido')), 4000);
  });
}

let failures = 0;
const expect = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('PASS:', msg);
  }
};

const playerOf = (client, playerId) =>
  client.state?.players.find((p) => p.id === playerId);

(async () => {
  // Socket sem sessao nao passa do handshake.
  const anon = await expectUnauthenticated();
  expect(
    anon.err.message === 'UNAUTHENTICATED',
    'socket sem sessao e recusado no handshake',
  );
  anon.socket.close();

  const cookieA = await signUp('Alice');
  const cookieB = await signUp('Bob');
  const cookieC = await signUp('Carol');

  // Alice e a dona das duas salas.
  const created = await apiCreateRoom(cookieA, 'Sala do Smoke');
  ROOM = created.id;
  ROOM2 = (await apiCreateRoom(cookieA, 'Sala Secundaria')).id;
  expect(created.isOwner === true, 'quem cria a sala vira dona');
  expect(created.name === 'Sala do Smoke', 'sala nasce com o nome enviado');

  // Sala que nunca foi criada nao existe mais -- e a mudanca central do feature.
  const ghost = await api('GET', '/api/rooms/NAOEXISTE', cookieA);
  expect(ghost.status === 404, 'GET de sala inexistente devolve 404');

  const a = await makeClient('Alice', { pokeId: 25, cookie: cookieA });
  const b = await makeClient('Bob', { pokeId: 6, cookie: cookieB });
  const c = await makeClient('Carol', { role: 'spectator', pokeId: 1, cookie: cookieC });
  await sleep(200);

  expect(a.state.players.length === 3, 'tres jogadores na sala');

  // --- mascaramento por espectador ---
  a.socket.emit('vote:cast', { value: '5' });
  b.socket.emit('vote:cast', { value: '5' });
  await sleep(200);

  expect(
    playerOf(a, a.playerId).vote === '5',
    'quem votou ve a PROPRIA carta antes do reveal',
  );
  expect(
    playerOf(b, a.playerId).vote === 'HIDDEN',
    'a carta dos outros continua escondida antes do reveal',
  );

  // --- reveal ---
  a.socket.emit('vote:reveal');
  await sleep(200);

  expect(a.state.revealed === true, 'flag de revelado setada');
  expect(playerOf(a, b.playerId).vote === '5', 'valor real visivel depois do reveal');
  expect(playerOf(a, c.playerId).role === 'spectator', 'papel de espectador preservado');
  expect(playerOf(a, c.playerId).vote === null, 'espectador nunca tem voto');

  // --- voto recusado ainda devolve a verdade para quem clicou ---
  b.state = null;
  b.socket.emit('vote:cast', { value: '13' });
  await sleep(200);
  expect(b.state !== null, 'voto recusado ainda entrega room:state a quem votou');
  expect(playerOf(b, b.playerId).vote === '5', 'o voto recusado nao alterou nada');

  a.socket.emit('vote:reset');
  await sleep(200);
  expect(a.state.revealed === false, 'reset limpa o flag de revelado');
  expect(
    a.state.players.every((p) => p.vote === null),
    'reset limpa todos os votos',
  );

  // --- reconexao dentro da graca: religa o assento, nao duplica ---
  b.socket.emit('vote:cast', { value: '8' });
  await sleep(150);
  const bobId = b.playerId;
  b.socket.disconnect();
  await sleep(300);

  const bob2 = await makeClient('Bob', { pokeId: 6, cookie: cookieB });
  await sleep(250);

  expect(a.state.players.length === 3, 'reconexao NAO cria jogador duplicado');
  expect(bob2.playerId === bobId, 'reconexao devolve o mesmo playerId');
  expect(playerOf(a, bobId).online === true, 'jogador religado volta a ficar online');
  expect(playerOf(bob2, bobId).vote === '8', 'voto preservado na reconexao');

  // --- remocao automatica depois da graca ---
  a.socket.emit('vote:reset'); // libera o voto para o reaper alcancar
  await sleep(150);
  bob2.socket.disconnect();
  await sleep(GRACE_MS + 1200);

  expect(
    a.state.players.length === 2,
    'jogador ausente alem da graca e removido sozinho',
  );
  expect(playerOf(a, bobId) === undefined, 'o fantasma sumiu da mesa');

  // --- membership obsoleta: duas abas num assento, uma delas sai ---
  // Alcancavel de verdade: `room:leave` de uma aba apaga o assento inteiro, e a
  // outra aba continua com roomId/playerId apontando para um jogador que nao
  // existe mais.
  const cookieE = await signUp('Erin');
  const tab1 = await makeClient('Erin', { pokeId: 7, cookie: cookieE });
  // Mesmo cookie = mesma pessoa: e isto que faz as duas abas dividirem assento.
  const tab2 = await makeClient('Erin', { pokeId: 7, cookie: cookieE });
  await sleep(200);
  expect(tab2.playerId === tab1.playerId, 'duas abas compartilham um assento');
  expect(a.state.players.length === 3, 'a segunda aba nao adiciona jogador');

  tab1.socket.emit('room:leave');
  await sleep(250);

  tab2.socket.emit('vote:reveal');
  await sleep(250);
  expect(
    a.state.revealed === false,
    'socket sem assento na sala nao consegue revelar',
  );
  expect(
    tab2.lastError?.code === 'NOT_IN_ROOM',
    'socket obsoleto recebe NOT_IN_ROOM em vez de falhar em silencio',
  );
  tab1.socket.disconnect();
  tab2.socket.disconnect();
  await sleep(200);

  // --- dois usuarios distintos com o MESMO nome de exibicao ---
  const cookieAlice2 = await signUp('Alice');
  const alice2 = await makeClient('Alice', { pokeId: 25, cookie: cookieAlice2 });
  await sleep(250);
  const alices = a.state.players.filter((p) => p.name === 'Alice');
  expect(alices.length === 2, 'dois usuarios com o mesmo nome ocupam dois assentos');
  expect(
    alices[0].id !== alices[1].id,
    'assentos distintos, mesmo com nome de exibicao identico',
  );
  alice2.socket.disconnect();
  await sleep(GRACE_MS + 800);

  // --- normalizacao de sala ---
  const cookieD = await signUp('Dave');
  const lower = await makeClient('Dave', {
    pokeId: 4,
    room: ROOM.toLowerCase(),
    cookie: cookieD,
  });
  await sleep(250);
  expect(
    lower.state.players.length === 3,
    'grafias diferentes do id caem na MESMA sala',
  );

  // --- trocar de sala nao deixa orfao na anterior ---
  lower.socket.emit('room:join', {
    roomId: ROOM2,
    name: 'Dave',
    role: 'voter',
    pokemon: samplePokemon('dave', 4),
  });
  await sleep(300);
  expect(
    a.state.players.length === 2,
    'trocar de sala remove o jogador da sala anterior',
  );

  // --- sala precisa existir para ser jogavel ---
  const ghostErr = await new Promise((resolve) => {
    a.socket.once('room:error', resolve);
    a.socket.emit('room:join', {
      roomId: 'NAOEXISTE',
      name: 'Alice',
      role: 'voter',
      pokemon: samplePokemon('alice', 25),
    });
    setTimeout(() => resolve(null), 2000);
  });
  expect(ghostErr?.code === 'ROOM_NOT_FOUND', 'join em sala inexistente da ROOM_NOT_FOUND');
  expect(
    a.state.players.length === 2,
    'join recusado NAO expulsa quem ja estava na sala anterior',
  );

  // --- so o dono renomeia, e o nome novo chega na mesa ---
  const forbidden = await api('PATCH', `/api/rooms/${ROOM}`, cookieC, { name: 'Hack' });
  expect(forbidden.status === 403, 'nao-dono nao consegue renomear (403)');

  const renamed = await api('PATCH', `/api/rooms/${ROOM}`, cookieA, { name: 'Squad BO' });
  expect(renamed.status === 200, 'dono renomeia a sala');
  await sleep(250);
  expect(c.state?.name === 'Squad BO', 'nome novo chega ao vivo por room:state');
  expect(c.state?.isOwner === false, 'quem nao e dono recebe isOwner false');
  expect(a.state?.isOwner === true, 'a dona recebe isOwner true');

  // --- favoritar ---
  const fav = await api('PUT', `/api/rooms/${ROOM}/favorite`, cookieC);
  expect(fav.status === 204, 'favoritar devolve 204');
  const listC = await api('GET', '/api/rooms', cookieC);
  const favRow = listC.body.find((r) => r.id === ROOM);
  expect(
    favRow?.isFavorite === true && favRow?.isOwner === false,
    'sala favoritada aparece na home de quem nao e dono',
  );
  expect(favRow?.onlineCount >= 1, 'onlineCount reflete a memoria do servidor');

  // --- excluir expulsa todo mundo ---
  const closedPromise = new Promise((resolve) => {
    c.socket.once('room:closed', resolve);
    setTimeout(() => resolve(null), 2000);
  });
  const forbiddenDel = await api('DELETE', `/api/rooms/${ROOM}`, cookieC);
  expect(forbiddenDel.status === 403, 'nao-dono nao consegue excluir (403)');

  const del = await api('DELETE', `/api/rooms/${ROOM}`, cookieA);
  expect(del.status === 204, 'dono exclui a sala');
  const closedMsg = await closedPromise;
  expect(closedMsg?.roomId === ROOM, 'quem estava dentro recebe room:closed');

  const gone = await api('GET', `/api/rooms/${ROOM}`, cookieA);
  expect(gone.status === 404, 'sala excluida some do banco');
  const listCAfter = await api('GET', '/api/rooms', cookieC);
  expect(
    !listCAfter.body.some((r) => r.id === ROOM),
    'sala excluida some tambem dos favoritos de quem favoritou',
  );

  a.socket.disconnect();
  c.socket.disconnect();
  lower.socket.disconnect();

  if (failures > 0) {
    console.error(`\n${failures} SMOKE TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL SMOKE TESTS PASSED');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
