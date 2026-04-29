# BO Poker

Scrum Poker para o time de **BackOffice**, com tema Pokémon discreto e dark mode.

Inspirado no fluxo do [ScrumJam](https://www.scrumjam.app/poker/). Sem autenticação, sem banco — estado vive em memória no servidor enquanto a sala estiver ativa.

---

## Funcionalidades (MVP)

- Criar sala e entrar via código (URL compartilhável).
- Dialog de entrada: nome + 8 Pokémon aleatórios da 1ª geração (PokéAPI).
- Votação com revelação simultânea (cartas viradas com flip 3D em stagger).
- Modo espectador (não vota, só observa).
- Botão **copiar link** da sala.
- Estatísticas após reveal: média, moda, indicador de consenso.
- Animação **"✨ Super efetivo!"** quando há consenso numérico.
- Qualquer jogador pode revelar / iniciar nova rodada.
- Jogadores desconectados ficam offline na lista até a sala ser resetada.

---

## Stack

**Frontend** (`client/`): React 18, Vite, TypeScript, TailwindCSS, Zustand, React Router v6, socket.io-client.

**Backend** (`server/`): Node 20+, Express, Socket.io, TypeScript. Estado em memória (`Map<string, Room>`).

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
│       ├── components/    # EntryDialog, PokerTable, PlayerCard, CardDeck, ...
│       ├── store/         # zustand
│       ├── hooks/         # useSocket, useRoom
│       ├── services/      # socket singleton, pokeapi
│       ├── utils/         # stats, cn
│       └── types/         # tipos espelhados do server
├── server/                # Express + Socket.io
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── rooms/         # Room, RoomManager (singleton)
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

**Servidor → Cliente**

| Evento             | Payload                |
|--------------------|------------------------|
| `room:state`       | `RoomState` (broadcast a cada mudança) |
| `room:joined`      | `{ playerId }`         |
| `room:error`       | `{ code, message }`    |

Antes do reveal, o campo `vote` de cada jogador é mascarado: `null` se ainda não votou, `'HIDDEN'` se votou, e o valor real só aparece quando `revealed === true`.

---

## Decisões de implementação

- **Tipos duplicados** em `client/src/types/` e `server/src/types/` (mantidos sincronizados manualmente) em vez de um pacote `shared`, mantendo o workspace pnpm enxuto.
- **Reconexão**: o socket.io-client reconecta sozinho; o `useRoom` reemite `room:join` automaticamente após o `connect` se o usuário já tinha entrado na sala. Isso cria uma nova entrada de Player no servidor (o player anterior fica marcado offline até alguém resetar a sala — comportamento previsto pelo MVP).
- **Cleanup**: a cada 30 min, o servidor remove salas onde todos os jogadores estão offline há mais de 2 horas.
- **Animações**: tudo em CSS puro (`@keyframes` + classes do Tailwind config) — sem framer-motion.
- **Card flip**: 3D real com `transform: rotateY(180deg)` + `backface-visibility: hidden`, stagger de 80 ms por índice de jogador.

---

## Smoke test

Validação rápida do fluxo socket (sobe 3 clientes simulados em uma sala e checa estado):

```bash
# Com o servidor rodando (pnpm dev:server ou pnpm start):
pnpm smoke
```

O script `scripts/smoke.mjs` usa o `socket.io-client` instalado como devDependency da raiz do workspace.

---

## Não-objetivos

Sem autenticação, login, persistência, histórico de rodadas, exportação, timer ou modo claro. Sem libs pesadas de UI. O tema Pokémon é uma **camada sutil** — vibe Linear/Vercel com acentos da PokéBola, não Game Boy.
