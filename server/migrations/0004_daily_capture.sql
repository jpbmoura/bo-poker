-- Captura diaria: uma linha por (usuario, dia) em que ele TENTOU. O Pokemon do
-- dia nao e guardado -- e derivado da data (server/src/capture/dailySpawn.ts).
-- "day" e a data civil em America/Sao_Paulo, calculada pela aplicacao.
create table "daily_capture" (
  "userId"          text not null references "user" ("id") on delete cascade,
  "day"             date not null,
  -- O teto de 3 e garantido aqui E no upsert condicional do captureStore: duas
  -- abas clicando juntas nunca conseguem a 4a tentativa.
  "attempts"        integer not null default 0,
  "caught"          boolean not null default false,
  -- Set null: soltar o Pokemon depois nao apaga o historico da captura.
  "caughtPokemonId" text references "trainer_pokemon" ("id") on delete set null,
  "updatedAt"       timestamptz default CURRENT_TIMESTAMP not null,
  primary key ("userId", "day"),
  constraint "daily_capture_attempts_range" check ("attempts" between 0 and 3)
);
