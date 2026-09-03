# BO Poker

Scrum Poker para o time de **BackOffice**, com tema Pokémon discreto e dark mode.

Inspirado no fluxo do [ScrumJam](https://www.scrumjam.app/poker/). Login pelo GitHub identifica cada jogador. As **salas são persistidas** no Postgres (código, nome, dono e favoritos); o **estado das rodadas** continua vivendo em memória no servidor enquanto a sala estiver ativa.

---

## Funcionalidades (MVP)

- **Salas persistidas**: criar uma sala grava no banco. O link não expira e o código só deixa de funcionar quando o dono exclui.
- **Home como painel**: depois do login, as salas que você criou ou favoritou aparecem em cards com nome, código e quantas pessoas estão online agora. Coroa dourada no canto quando você é o dono.
- **Dono da sala**: quem cria pode renomear, excluir e copiar o link. Poderes de rodada (revelar, nova rodada, limpar inativos) seguem abertos a todos.
- **Favoritos**: qualquer pessoa favorita uma sala pela estrela e ela passa a aparecer na home dela.
- Excluir a sala expulsa quem estiver dentro na hora, com aviso.
- Entrar via código (URL compartilhável). Código inexistente mostra "Sala não encontrada" em vez de criar uma sala nova.
- Dialog de entrada: nome + 8 Pokémon aleatórios da 1ª geração (PokéAPI).
- Votação com revelação simultânea (cartas viradas com flip 3D em stagger).
- Modo espectador (não vota, só observa).
- Botão **copiar link** da sala.
- Estatísticas após reveal: média, moda, indicador de consenso.
- Animação **"✨ Super efetivo!"** quando há consenso numérico.
- Qualquer jogador pode revelar / iniciar nova rodada — inclusive quem não é dono.
- Jogadores desconectados ficam offline na lista e são removidos sozinhos após um período de graça (padrão 45 s). Quem já votou só é removido depois da rodada terminar, para a média não mudar sozinha no meio dela.
- Reconectar ou dar F5 devolve o mesmo assento, com o voto preservado — não cria jogador duplicado.

---

## Stack

**Frontend** (`client/`): React 18, Vite, TypeScript, TailwindCSS, Zustand, React Router v6, socket.io-client.

**Backend** (`server/`): Node 20+, Express, Socket.io, TypeScript. Metadados das salas no Postgres; estado das rodadas em memória (`Map<string, Room>`).

**Monorepo**: pnpm workspaces (`pnpm-workspace.yaml`).

**Externo**: [PokéAPI](https://pokeapi.co/) (apenas IDs 1–151, com cache em memória + `localStorage`).

---

## Como rodar

Requer **pnpm** (`npm i -g pnpm` se ainda não tiver).

```bash
# Na raiz do projeto:
pnpm install   # instala client + server + raiz (workspace)
pnpm dev       # sobe os dois em paralelo (concurrently)
```

URLs:

- Cliente: <http://localhost:5173>
- Servidor: <http://localhost:3001> (health check em `/health`)

O Vite faz proxy de `/socket.io` para o servidor, então no dev o cliente conecta direto pela origem `:5173`.

Atalhos:

```bash
pnpm dev:server          # apenas o servidor
pnpm dev:client          # apenas o cliente
pnpm --filter bo-poker-client <script>   # rodar script só num pacote
```

### Build de produção

```bash
pnpm build
pnpm start   # roda o server compilado em ./server/dist
```

Em produção o próprio Express serve `client/dist/` e faz fallback de SPA (`/room/:id` → `index.html`). O cliente conecta no socket pelo mesmo origin, então não precisa de CORS nem de variável apontando para a API.

---

## Deploy no Railway (single service)

Já está tudo configurado em [railway.json](railway.json):

- `build`: `pnpm install --frozen-lockfile && pnpm build`
- `start`: `pnpm start`
- `healthcheckPath`: `/health`

Passos:

1. **Criar projeto** no Railway → *Deploy from GitHub repo* (ou `railway up` via CLI).
2. Railway detecta `pnpm-lock.yaml` e usa Nixpacks com pnpm automaticamente; o `railway.json` sobrescreve os comandos de build/start.
3. **Variáveis de ambiente** — nenhuma é obrigatória. Opcionais:
   - `PORT` — Railway injeta automaticamente, o servidor lê via `process.env.PORT`.
   - `CORS_ORIGIN` — só necessário se for hospedar o cliente em outro domínio.
4. **Domínio público**: em *Settings → Networking → Generate Domain*. Pronto, a URL serve o app inteiro (frontend + WebSocket).

Como cliente e servidor compartilham origin, WebSocket funciona sem ajuste — o `socket.io-client` chama `io()` sem URL e conecta no mesmo host. O Railway suporta upgrade WebSocket nativamente.

Para validar pós-deploy: abra `https://<seu-app>.up.railway.app/health` (deve retornar `{"status":"ok"}`) e em duas abas teste criar/entrar numa sala.

---

## Variáveis de ambiente (server)

| Variável       | Default                       | Descrição                              |
|----------------|-------------------------------|----------------------------------------|
| `PORT`         | `3001`                        | Porta do servidor.                     |
| `CORS_ORIGIN`  | `http://localhost:5173`       | Origens permitidas (lista por vírgula). |

---

## Estrutura

```
bo-poker/
├── package.json           # scripts dev/build (pnpm + concurrently)
├── pnpm-workspace.yaml    # workspace de client + server
├── client/                # SPA React/Vite
│   └── src/
│       ├── pages/         # HomePage, RoomPage
│       ├── components/    # EntryDialog, PokerTable, PlayerCard, CardDeck, RoomCard, ...
│       ├── store/         # zustand
│       ├── hooks/         # useSocket, useRoom
│       ├── services/      # socket singleton, pokeapi, rooms (REST)
│       ├── utils/         # stats, cn
│       └── types/         # tipos espelhados do server
├── server/                # Express + Socket.io
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── rooms/         # Room, RoomManager (singleton), roomStore (SQL)
│       ├── routes/        # rooms.ts (API HTTP de salas)
│       ├── socket/        # handlers, events
│       └── types/
└── scripts/
    └── smoke.mjs          # smoke test de socket (3 clientes simulados)
```

---

## Eventos Socket.io

**Cliente → Servidor**

| Evento             | Payload                                              |
|--------------------|------------------------------------------------------|
| `room:join`        | `{ roomId, name, pokemon, role }`                    |
| `room:leave`       | `{}`                                                 |
| `vote:cast`        | `{ value: CardValue }`                               |
| `vote:reveal`      | `{}`                                                 |
| `vote:reset`       | `{}`                                                 |
| `player:setRole`   | `{ role: 'voter' \| 'spectator' }`                   |
| `room:clearInactive` | `{}`                                               |

**Servidor → Cliente**

| Evento             | Payload                |
|--------------------|------------------------|
| `room:state`       | `RoomState` (enviado a cada mudança, **por espectador**) |
| `room:joined`      | `{ playerId, role }`   |
| `room:error`       | `{ code, message }`    |
| `room:closed`      | `{ roomId, reason }` — o dono excluiu a sala; quem está dentro é mandado para a home |

O `RoomState` carrega `name` e `isOwner`. O `isOwner` é calculado **por espectador** (comparando a `identityKey` de quem recebe com o dono) em vez de mandar o `ownerId` cru: o estado vai para toda a mesa, e o id de usuário de outra pessoa não precisa circular.

O `room:join` **exige que a sala exista**. Um código desconhecido devolve `ROOM_NOT_FOUND`; se o banco estiver fora do ar, devolve `ROOM_UNAVAILABLE` — são coisas diferentes de propósito (ver *Decisões*).

Antes do reveal, o campo `vote` de cada jogador é mascarado: `null` se ainda não votou, `'HIDDEN'` se votou, e o valor real só aparece quando `revealed === true`.

O estado é serializado **na perspectiva de quem recebe** (`Room.serializeFor`): cada jogador vê o próprio voto sem máscara, o dos outros como `'HIDDEN'`. Por isso o `room:state` sai socket a socket em vez de um broadcast único — e o cliente não precisa de nenhum estado otimista para saber qual carta está selecionada.

**O `room:join` não carrega identidade.** Quem é o jogador vem da sessão autenticada do socket: o handshake passa por um `io.use()` que valida o cookie do Better Auth e coloca o usuário em `socket.data`. `name` e `pokemon` são cosméticos e validados; `identityKey` e `login` só a sessão define. Toda autorização passa por `requireMember`, que também recusa sessão expirada — o `io.use()` roda uma vez só, no handshake.

---

## API HTTP de salas

Tudo sob `/api/rooms`, autenticado pelo mesmo cookie de sessão do Better Auth. As mutações exigem `Origin` confiável (a mesma lista dos `trustedOrigins`).

| Método | Rota | O que faz |
|---|---|---|
| `GET`    | `/api/rooms` | Salas que eu criei **ou** favoritei |
| `POST`   | `/api/rooms` | Cria (gera o código, dono = sessão) |
| `GET`    | `/api/rooms/:id` | Uma sala; `404` se não existir |
| `PATCH`  | `/api/rooms/:id` | Renomeia; `403` se não for dono |
| `DELETE` | `/api/rooms/:id` | Exclui e expulsa quem está dentro; `403` se não for dono |
| `PUT`/`DELETE` | `/api/rooms/:id/favorite` | Favorita / desfavorita |

Erro de banco responde **503**, nunca 404 — a diferença importa (ver a decisão logo abaixo).

O `onlineCount` de cada sala vem da **memória** (`RoomManager`), não do banco: o Express roda no mesmo processo do estado das rodadas. A home revalida na montagem e no `focus` da janela; não existe canal de presença no socket.

> **Ordem de montagem no `index.ts`**: `/api/auth` → `express.json()` → `/api/rooms` → fallback de SPA. O router precisa vir antes do `app.get('*')`, senão só o **GET** `/api/rooms` seria engolido (devolvendo `index.html` com 200) enquanto POST/PATCH/DELETE seguiriam funcionando — uma falha invisível em dev, porque o proxy do Vite a esconde. Verifique com `curl -i http://localhost:3001/api/rooms` **contra o build de produção**.

---

## Decisões de implementação

- **Contrato de wire compartilhado**: `client/src/types/wire.ts` e `server/src/types/wire.ts` são **byte-idênticos** e sem imports, em vez de um pacote `shared` (que não se paga num app deste tamanho). `server/src/types/wire.test.ts` compara os dois arquivos e quebra o build se divergirem.
- **Identidade e reconexão**: o jogador é indexado por uma `identityKey` estável (`user:<id do GitHub>`), não pelo `socket.id`. `Room.upsertPlayer` **religa** a entrada existente em vez de criar outra, preservando voto e `joinedAt` — é isso que faz F5 e queda de rede não duplicarem ninguém. Cada jogador guarda um `Set` de sockets, então abas duplicadas compartilham um assento sem derrubar uma à outra. O `useRoom` reemite `room:join` no `connect`, e a operação é idempotente.
- **Preferências da aba**: `client/src/services/session.ts` guarda nome/pokémon/role por **usuário e sala** em `sessionStorage` — não é identidade, só evita reabrir o diálogo no F5. A chave inclui o id do usuário para que trocar de conta na mesma aba não reaproveite o perfil anterior. Storage inacessível (modo privado, iframe sandboxed) cai num fallback em memória em vez de quebrar.
- **Nome de exibição**: vem do GitHub (só o primeiro nome), é editável e fica salvo **na conta** via `authClient.updateUser`, então segue a pessoa entre salas e máquinas. Dois jogadores podem ter o mesmo nome — o `@handle` do GitHub aparece no tooltip do card para desambiguar.
- **Saída deliberada vs. queda**: sair pelo botão ou trocar de sala pela URL libera o assento na hora; só desconexão involuntária passa pelo período de graça.
- **Cleanup**: uma varredura a cada `PLAYER_SWEEP_INTERVAL_MS` (padrão 10 s) remove jogadores offline há mais de `PLAYER_GRACE_MS` (padrão 45 s), apaga salas que esvaziaram e as que passaram do TTL com todo mundo offline. A política vive em métodos puros com relógio injetado (`Room.reapOffline`, `RoomManager.sweep`); só o agendamento fica no `index.ts`.
- **Salas persistidas, rodadas efêmeras**: o Postgres guarda o *cadastro* da sala (código, nome, dono, favoritos); a `Map<string, Room>` guarda a *rodada*. O sweep continua coletando a sala da memória quando ela esvazia — e isso agora é uma melhoria, não uma perda: o link continua valendo para sempre, e no próximo join o nome e o dono são relidos do banco. Consequência: o campo `rooms` do `/health` significa "salas **ativas** em memória", não "salas existentes".
- **Banco fora do ar nunca vira "sala não existe"**: o `room:join` resolve a sala **da memória primeiro** e só consulta o Postgres quando ela não está viva. Duas coisas saem disso: uma oscilação do banco não impede reconexão, F5 nem gente nova entrando numa rodada em andamento (mesma regra do `/health` e do `pool.on('error')`); e uma falha de consulta devolve `ROOM_UNAVAILABLE`, não `ROOM_NOT_FOUND` — quem ouve "não encontrada" cria uma sala duplicada e fragmenta o time. O preço aceito: com o banco fora, salas frias não abrem.
- **O `room:join` resolve a sala ANTES de soltar a anterior.** Invertido — que era a ordem antiga, inofensiva quando toda sala era criada sob demanda — um código inexistente expulsaria a pessoa da mesa onde ela estava só para depois falhar.
- **Guarda de `socket.connected` depois do `await` do banco.** O handler de join virou assíncrono, e o socket pode cair no meio. Sem a guarda, o `upsertPlayer` criaria um jogador `online: true` preso a um socket morto — e ele seria **incoletável**, porque `reapOffline` pula quem está online e `allOfflineSince()` devolve `null`. Vazamento permanente de sala.
- **O dono é só do cadastro.** Renomear, excluir e copiar link são dele; revelar, nova rodada e limpar inativos continuam de todos. A mesa segue horizontal — o dono existe para a sala ter nome e alguém poder apagá-la, não para mandar na rodada.
- **Autorização**: `requireMember` exige que o socket seja membro atual da sala para votar, revelar, resetar ou limpar inativos. Qualquer membro pode fazer todas essas ações: o dono da sala **não** tem poder extra sobre a rodada.
- **Animações**: mistura de CSS puro (`@keyframes` + classes do Tailwind config) e **framer-motion** (`PokerTable`, `PlayerCard`, `Confetti`).
- **Card flip**: 3D real com `transform: rotateY(180deg)` + `backface-visibility: hidden`, em onda center-out com passo de 120 ms (`WAVE_STEP_MS`).
- **Coreografia do reveal**: a ordem das cartas e os atrasos são congelados por id de jogador no instante do reveal (`orderIds` + `delayById`). Derivá-los do índice no array fazia todo atraso mudar quando a ordenação entrava, reiniciando a animação dos Pokémon no meio. Quem entra com a rodada já revelada pula direto para o estado final, sem repetir a coreografia.

---

## Variáveis de ambiente (servidor)

Todas opcionais.

| Variável | Padrão | Para que serve |
|---|---|---|
| `DATABASE_URL` | — | **Obrigatória.** Postgres: usuário/sessão do Better Auth **e** o cadastro das salas |
| `BETTER_AUTH_SECRET` | — | **Obrigatória.** `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3001` | URL do **servidor**, não do browser (ver abaixo) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | — | **Obrigatórias.** OAuth App do GitHub |
| `ENABLE_DEV_PASSWORD_AUTH` | `false` | Login por e-mail/senha para o smoke test. **Nunca em produção** — o servidor se recusa a subir se estiver ligada com `NODE_ENV=production` |
| `PORT` | `3001` | Porta HTTP |
| `CORS_ORIGIN` | `http://localhost:5173` | Origens permitidas, separadas por vírgula |
| `PLAYER_GRACE_MS` | `45000` | Quanto um jogador offline sobrevive antes de ser removido |
| `PLAYER_SWEEP_INTERVAL_MS` | `10000` | Frequência da varredura |
| `CLEAR_INACTIVE_MIN_OFFLINE_MS` | `10000` | Tempo mínimo offline para o botão manual alcançar alguém |
| `ROOM_TTL_MS` | `7200000` | TTL de sala com todo mundo offline |

> **`BETTER_AUTH_URL` é a URL do servidor.** Em dev continua sendo `http://localhost:3001` mesmo com o Vite na `:5173`: cookies ignoram porta, então o cookie emitido pela `:3001` chega à `:5173`. O Vite faz proxy de `/api/auth` e `/socket.io`. Consequência: `callbackURL` precisa ser **absoluto** (`absoluteUrl()` em `client/src/services/auth.ts`), senão resolveria contra a `:3001`, que não serve o client.

> **Deploy**: o estado das salas vive na memória de um processo. O serviço **precisa rodar com 1 réplica** — com duas, cada uma teria a sua própria sala. Escalar horizontalmente exigiria um adapter de Redis e estado compartilhado.

### Deploy no Railway (um serviço)

O servidor **já serve o `client/dist`** (`server/src/index.ts`), então um único serviço entrega a aplicação inteira — que é o arranjo mais simples e o único sem cookie cross-site. O `railway.json` da raiz descreve exatamente esse serviço: build `pnpm build`, start `pnpm start`, healthcheck `/health` e as migrations no `preDeployCommand`.

Variáveis no serviço da aplicação:

```
DATABASE_URL         = ${{<serviço-do-postgres>.DATABASE_URL}}
BETTER_AUTH_SECRET   = <openssl rand -base64 32>
BETTER_AUTH_URL      = https://<dominio-do-servico>
GITHUB_CLIENT_ID     = <do OAuth App>
GITHUB_CLIENT_SECRET = <do OAuth App>
```

`CORS_ORIGIN` é dispensável aqui: em produção, sem ela, a origem confiável passa a ser a própria `BETTER_AUTH_URL`. `ENABLE_DEV_PASSWORD_AUTH` **não pode existir** neste ambiente.

> **Um repo, vários serviços.** O `railway.json` fica na raiz e descreve o serviço da aplicação. Qualquer outro serviço apontado para este mesmo repo vai herdá-lo e tentar rodar `pnpm start` (que sobe o servidor) e o `preDeployCommand` das migrations — sem `DATABASE_URL`, isso vira crash-loop. Cada serviço adicional precisa da própria configuração.

### Cliente e servidor em domínios separados

Se o cliente e o servidor forem serviços distintos, os dois domínios **precisam ser subdomínios do mesmo domínio raiz** (ex.: `poker.exemplo.com` e `api-poker.exemplo.com`).

O motivo é o cookie de sessão. Subdomínios de um mesmo domínio registrável são *same-site*, então o cookie viaja normalmente com `SameSite=Lax`. Já dois domínios de raízes diferentes — inclusive dois `*.up.railway.app`, porque `up.railway.app` está na [Public Suffix List](https://publicsuffix.org/) — tornariam o cookie de **terceiros**: o Safari bloqueia por padrão e o login simplesmente não funcionaria.

Nesse arranjo:

| Onde | Variável | Valor |
|---|---|---|
| serviço do servidor | `BETTER_AUTH_URL` | `https://api-poker.exemplo.com` |
| serviço do servidor | `CORS_ORIGIN` | `https://poker.exemplo.com` |
| serviço do cliente | `VITE_SERVER_URL` | `https://api-poker.exemplo.com` (build time) |

O callback do GitHub aponta sempre para o **servidor**: `https://api-poker.exemplo.com/api/auth/callback/github`.

Com cliente e servidor na mesma origem (o `pnpm start` serve o `client/dist`), nada disso é necessário: deixe `VITE_SERVER_URL` vazio.

> **Atenção com o `railway.json` num repo de dois serviços.** Ele está na raiz e traz `startCommand`, `healthcheckPath` e o `preDeployCommand` das migrations — tudo pertinente **só ao servidor**. Garanta que o serviço do cliente não o herde, senão o pre-deploy dele tentará migrar um banco que ele não tem e o deploy vai falhar.

---

## Setup do login (GitHub + Postgres)

1. **OAuth App** em <https://github.com/settings/developers>. Registre os dois callbacks:
   - `http://localhost:3001/api/auth/callback/github`
   - `https://<dominio>/api/auth/callback/github`

   O escopo `user:email` é pedido automaticamente e é **obrigatório**: sem ele, quem tem e-mail primário privado no GitHub volta do callback com `email: null`.

2. **Variáveis**: `cp .env.example .env` e preencha.

3. **Banco local e migrations**:

```bash
pnpm db:up        # sobe o Postgres do docker-compose
pnpm db:migrate   # aplica server/migrations/*.sql
```

Tabelas: `user`, `session`, `account`, `verification` (do Better Auth, em `0001_auth_init.sql`) e `room` + `room_favorite` (em `0002_rooms.sql`). O código da sala é a própria PK de `room`; `ownerId` e os favoritos referenciam `user` com `on delete cascade`.

Para regenerar o schema depois de mexer na config do Better Auth (a CLI exige Node ≥ 22; o runtime do projeto segue no 20):

```bash
cd server && npx auth@latest generate --config src/auth.ts --output migrations/000N_nome.sql
```

No Railway as migrations rodam pelo `preDeployCommand` do `railway.json` — uma falha aborta o deploy em vez de derrubar o app.

> **Contas GitHub com o mesmo e-mail entram como o mesmo usuário.** O *account linking* do Better Auth é padrão e o e-mail do GitHub é verificado. Para conta pessoal + trabalho isso costuma ser desejável (uma identidade, um assento).

---

## Testes

```bash
pnpm test    # unitários de Room/RoomManager + sincronia dos tipos de wire
```

## Smoke test

Validação end-to-end do fluxo socket (reconexão, remoção por graça, mascaramento por espectador, normalização de sala). Precisa da graça curta para não levar 45 s:

```bash
# 1) suba o servidor com a graca curta e o login de teste:
ENABLE_DEV_PASSWORD_AUTH=true PLAYER_GRACE_MS=1500 PLAYER_SWEEP_INTERVAL_MS=250 pnpm dev:server

# 2) noutro terminal:
PLAYER_GRACE_MS=1500 pnpm smoke
```

Cada cliente do smoke faz sign-up por e-mail/senha na API real para obter um cookie de sessão assinado — inserir linhas no Postgres não bastaria, porque o cookie é assinado com o secret. O script também **cria as salas pela API** (`POST /api/rooms`): desde que sala precisa existir para ser jogável, entrar num id inventado não funciona mais.

Além do fluxo de rodada, o smoke cobre: `ROOM_NOT_FOUND` em sala inexistente, join recusado não expulsar da sala anterior, renomear ao vivo via `room:state`, `403` para não-dono em renomear/excluir, favoritar aparecendo na listagem e `room:closed` chegando a quem estava dentro quando o dono exclui.

O script `scripts/smoke.mjs` usa o `socket.io-client` instalado como devDependency da raiz do workspace.

---

## Não-objetivos

Sem persistência de **rodadas**, histórico, exportação, timer ou modo claro. O Postgres guarda usuário/sessão **e o cadastro das salas** (código, nome, dono, favoritos) — os votos e o estado da mesa continuam só em memória. Sem transferência de propriedade, sem sala privada, sem limite de salas por usuário. Sem libs pesadas de UI. O tema Pokémon é uma **camada sutil** — vibe Linear/Vercel com acentos da PokéBola, não Game Boy.
