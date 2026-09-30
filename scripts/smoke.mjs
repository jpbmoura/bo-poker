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
async function signUp(label, opts = {}) {
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
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');

  // O Pokemon virou progressao de CONTA: sem escolher um inicial o jogador
  // entra na mesa (o servidor falha macio) mas nao pontua, e as assercoes de XP
  // passariam vazias. `lineId: null` exercita justamente esse caso.
  if (opts.lineId !== null) {
    const chosen = await api('POST', '/api/trainer/pokemon', cookie, {
      lineId: opts.lineId ?? 'charmander',
    });
    if (chosen.status !== 200) {
      throw new Error(`escolha de inicial de ${label} falhou (${chosen.status})`);
    }
  }
  return cookie;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(name, opts = {}) {
  const { role = 'voter', room = ROOM, cookie } = opts;
  const socket = io(URL, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
  });
  const client = {
    socket,
    name,
    playerId: null,
    state: null,
    lastError: null,
    roundResult: null,
    evolutions: [],
  };
  socket.on('room:state', (s) => (client.state = s));
  socket.on('round:result', (result) => (client.roundResult = result));
  socket.on('pokemon:evolved', (e) => client.evolutions.push(e));
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      // Sem `pokemon` no payload: a especie vem da progressao da conta.
      socket.emit('room:join', { roomId: room, name, role });
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

  const a = await makeClient('Alice', { cookie: cookieA });
  const b = await makeClient('Bob', { cookie: cookieB });
  const c = await makeClient('Carol', { role: 'spectator', cookie: cookieC });
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

  const bob2 = await makeClient('Bob', { cookie: cookieB });
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
  const tab1 = await makeClient('Erin', { cookie: cookieE });
  // Mesmo cookie = mesma pessoa: e isto que faz as duas abas dividirem assento.
  const tab2 = await makeClient('Erin', { cookie: cookieE });
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
  const alice2 = await makeClient('Alice', { cookie: cookieAlice2 });
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

  // --- XP: distancia, trava anti-farm, consenso e evolucao ---
  // Sala propria: as rodadas aqui pontuam e nao podem contaminar as assercoes
  // de cima, que dependem de estado de mesa.
  const cookieX = await signUp('Xp1', { lineId: 'charmander' });
  const cookieY = await signUp('Xp2', { lineId: 'squirtle' });
  const cookieZ = await signUp('Xp3', { lineId: 'bulbasaur' });
  const xpRoom = (await apiCreateRoom(cookieX, 'Sala de XP')).id;

  const x = await makeClient('Xp1', { cookie: cookieX, room: xpRoom });
  const y = await makeClient('Xp2', { cookie: cookieY, room: xpRoom });
  const z = await makeClient('Xp3', { cookie: cookieZ, room: xpRoom });
  const cookieW = await signUp('XpEsp', { lineId: 'totodile' });
  const w = await makeClient('XpEsp', { cookie: cookieW, room: xpRoom, role: 'spectator' });

  const gainsOf = (client) =>
    Object.fromEntries((client.roundResult?.xp ?? []).map((e) => [e.playerId, e.gained]));

  async function playRound(votes) {
    for (const [client, value] of votes) client.socket.emit('vote:cast', { value });
    await sleep(120);
    x.socket.emit('vote:reveal');
    await sleep(200);
  }
  async function newRound() {
    x.socket.emit('vote:reset');
    await sleep(120);
  }

  // media 8.667 -> alvo fracionario 5.133 no deck -> 7 / 10 / 8
  await playRound([[x, '5'], [y, '8'], [z, '13']]);
  let gains = gainsOf(x);
  expect(x.roundResult?.awarded === true, 'rodada com 3 votos numericos pontua');
  expect(x.roundResult?.consensus === false, 'votos diferentes nao sao consenso');
  expect(gains[x.playerId] === 7, `distancia: quem votou 5 leva 7 (levou ${gains[x.playerId]})`);
  expect(gains[y.playerId] === 10, `distancia: quem votou 8 leva 10 (levou ${gains[y.playerId]})`);
  expect(gains[z.playerId] === 8, `distancia: quem votou 13 leva 8 (levou ${gains[z.playerId]})`);
  // Espectador leva a media do XP da mesa: (7 + 10 + 8) / 3 = 8.33 -> 8
  expect(gains[w.playerId] === 8, `espectador leva a media da mesa, 8 (levou ${gains[w.playerId]})`);

  const xAfter = x.state.players.find((p) => p.id === x.playerId);
  expect(xAfter?.progress?.xp === 7, 'o XP ganho aparece no room:state');
  await newRound();

  // Trava anti-farm: 2 votos numericos nao pontuam, nem sendo iguais.
  await playRound([[x, '5'], [y, '5']]);
  expect(x.roundResult?.awarded === false, 'menos de 3 votos numericos nao pontua');
  expect(
    Object.values(gainsOf(x)).every((g) => g === 0),
    'ninguem ganha XP numa rodada travada',
  );
  expect(!gainsOf(x)[w.playerId], 'espectador tambem nao ganha numa rodada travada');
  await newRound();

  // Consenso: dobro para todo mundo.
  await playRound([[x, '3'], [y, '3'], [z, '3']]);
  expect(x.roundResult?.consensus === true, 'todos na mesma carta e consenso');
  expect(
    Object.values(gainsOf(x)).every((g) => g === 20),
    'consenso paga o dobro (20) para cada votante',
  );
  expect(gainsOf(x)[w.playerId] === 20, 'no consenso o espectador tambem leva 20');
  await newRound();

  // Evolucao: consenso rende 20/rodada, entao 250 XP chega em 13 rodadas.
  // Xp1 ja tem 27, faltam 12 rodadas (13 no total desta serie por folga).
  const spriteBefore = x.state.players.find((p) => p.id === x.playerId).pokemon.id;
  expect(spriteBefore === 4, 'Xp1 comeca como Charmander');
  for (let i = 0; i < 12; i++) {
    await playRound([[x, '8'], [y, '8'], [z, '8']]);
    if (i < 11) await newRound();
  }

  const evolved = x.evolutions.filter((e) => e.playerId === x.playerId);
  expect(evolved.length === 1, `exatamente uma evolucao de Xp1 (foram ${evolved.length})`);
  expect(evolved[0]?.from.id === 4 && evolved[0]?.to.id === 5,
    'a evolucao vai de Charmander para Charmeleon');

  // O ADIAMENTO: o card ainda mostra a forma antiga ate a rodada seguinte,
  // senao o room:state entregaria a evolucao antes de a animacao tocar.
  const duringReveal = x.state.players.find((p) => p.id === x.playerId);
  expect(duringReveal.pokemon.id === 4,
    `a forma exibida so troca no reset (esta ${duringReveal.pokemon.id})`);
  expect(duringReveal.progress.xp >= 250, 'mas o XP ja passou do limiar');

  await newRound();
  const afterReset = x.state.players.find((p) => p.id === x.playerId);
  expect(afterReset.pokemon.id === 5, 'a forma nova aterrissa junto com a rodada nova');

  // Eevee: cruza o limiar e NAO evolui sozinho; a pedra e uma escolha.
  const cookieEv = await signUp('Eve', { lineId: 'eevee' });
  const ev = await makeClient('Eve', { cookie: cookieEv, room: xpRoom });
  for (let i = 0; i < 13; i++) {
    await playRound([[x, '8'], [y, '8'], [z, '8'], [ev, '8']]);
    await newRound();
  }
  const evPlayer = ev.state.players.find((p) => p.id === ev.playerId);
  expect(evPlayer.progress.xp >= 250, 'Eevee acumulou XP suficiente');
  expect(evPlayer.progress.pendingChoice === true, 'Eevee fica pendente da pedra');
  expect(evPlayer.pokemon.id === 133, 'e continua Eevee ate escolher');
  expect(
    ev.evolutions.filter((e) => e.playerId === ev.playerId).length === 0,
    'Eevee nao dispara evolucao sozinho',
  );

  const stone = await api('POST', `/api/trainer/pokemon/${evPlayer.progress.pokemonId}/branch`,
    cookieEv, { dexId: 197 });
  expect(stone.status === 200, 'escolher a pedra funciona');
  await sleep(200);
  const evolvedEv = ev.evolutions.filter((e) => e.playerId === ev.playerId);
  expect(evolvedEv.length === 1 && evolvedEv[0].to.id === 197,
    'a pedra dispara a evolucao para Umbreon na mesa inteira');

  const stoneAgain = await api('POST',
    `/api/trainer/pokemon/${evPlayer.progress.pokemonId}/branch`, cookieEv, { dexId: 134 });
  expect(stoneAgain.status === 409, 'a pedra e definitiva (409 na segunda vez)');

  // --- falha macia: sem inicial, entra e joga, so nao pontua ---
  const cookieNone = await signUp('SemPoke', { lineId: null });
  const none = await makeClient('SemPoke', { cookie: cookieNone, room: xpRoom });
  await sleep(150);
  const nonePlayer = none.state.players.find((p) => p.id === none.playerId);
  expect(nonePlayer !== undefined, 'quem nao escolheu inicial entra na sala mesmo assim');
  expect(nonePlayer.progress === null, 'e aparece sem progresso');
  expect(nonePlayer.pokemon.sprite === '', 'com o sprite vazio, que vira Pokebola no cliente');

  await playRound([[x, '5'], [y, '5'], [z, '5'], [none, '5']]);
  expect(gainsOf(x)[none.playerId] === 0, 'quem nao tem Pokemon ganha 0 XP');
  await newRound();

  // --- o inicial e a unica porta de graca ---
  const overLimit = await api('POST', '/api/trainer/pokemon', cookieX, { lineId: 'pichu' });
  expect(overLimit.status === 409 && overLimit.body.error === 'POKEMON_LIMIT',
    'segundo inicial e recusado com POKEMON_LIMIT');
  const cookieWild = await signUp('Selvagem', { lineId: null });
  const wildStarter = await api('POST', '/api/trainer/pokemon', cookieWild, { lineId: 'tauros' });
  expect(wildStarter.status === 400 && wildStarter.body.error === 'INVALID_LINE',
    'pokemon que nao e inicial nao se pega de graca');

  // --- captura diaria ---
  // Roda com qualquer CAPTURE_FORCE (ou nenhum): as assercoes valem para os dois
  // desfechos. O inicial e escolhido para NAO ser a linha do dia.
  const cookieCap = await signUp('Captura', { lineId: null });
  const today = await api('GET', '/api/capture/today', cookieCap);
  expect(today.status === 200 && today.body.status === 'available' && today.body.attempts === 0,
    'captura do dia comeca disponivel, com 0 tentativas');
  expect(today.body.chance > 0 && today.body.maxAttempts === 3, 'com chance e 3 tentativas');
  const capStarter = ['charmander', 'squirtle'].find((l) => l !== today.body.lineId);
  await api('POST', '/api/trainer/pokemon', cookieCap, { lineId: capStarter });

  const staleDay = await api('POST', '/api/capture/today/attempt', cookieCap, { day: '2000-01-01' });
  expect(staleDay.status === 409 && staleDay.body.error === 'DAY_CHANGED',
    'tentativa de um dia que ja passou e recusada com DAY_CHANGED');

  let caughtIt = false;
  let thrown = 0;
  for (let i = 0; i < 3 && !caughtIt; i++) {
    const shot = await api('POST', '/api/capture/today/attempt', cookieCap, { day: today.body.day });
    expect(shot.status === 200, `tentativa ${i + 1} aceita`);
    thrown++;
    expect(shot.body.capture.attempts === thrown, 'contador de tentativas avanca');
    caughtIt = shot.body.success;
    if (caughtIt) {
      expect(shot.body.capture.status === 'caught', 'sucesso marca o dia como capturado');
      const caught = shot.body.trainer.pokemon.find((p) => p.progress.lineId === today.body.lineId);
      expect(shot.body.trainer.pokemon.length === 2, 'o capturado entra na colecao');
      expect(caught?.progress.stage === today.body.stage, 'e nasce no estagio em que foi pego');
      expect(caught?.isActive === false, 'sem tirar o ativo da mesa');
    }
  }
  if (!caughtIt) {
    const after = await api('GET', '/api/capture/today', cookieCap);
    expect(after.body.status === 'fled', '3 falhas: o Pokemon foge');
  }
  const extra = await api('POST', '/api/capture/today/attempt', cookieCap, { day: today.body.day });
  expect(extra.status === 409 && extra.body.error === 'NO_ATTEMPTS',
    'depois de capturar ou gastar as 3, nao ha mais tentativa');

  // --- liberar esvazia a colecao e a mesa reflete na hora ---
  const xPokemonId = x.state.players.find((p) => p.id === x.playerId).progress.pokemonId;
  const released = await api('DELETE', `/api/trainer/pokemon/${xPokemonId}`, cookieX);
  expect(released.status === 200 && released.body.pokemon.length === 0,
    'liberar esvazia a colecao');
  await sleep(200);
  const xReleased = x.state.players.find((p) => p.id === x.playerId);
  expect(xReleased.progress === null, 'a mesa reflete a liberacao na hora');
  expect(xReleased !== undefined, 'e ninguem e expulso da sala por isso');

  for (const client of [x, y, z, ev, none]) client.socket.disconnect();
  await api('DELETE', `/api/rooms/${xpRoom}`, cookieX);

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
