-- Progressao de conta: uma linha por Pokemon POSSUIDO, nao uma por usuario.
-- Hoje o teto e 1 (MAX_POKEMON_PER_USER no pokedex.ts), mas o limite e de
-- aplicacao: o schema ja aguenta varios sem migracao nova.
create table "trainer_pokemon" (
  "id"        text not null primary key,
  "userId"    text not null references "user" ("id") on delete cascade,
  -- Slug da linha evolutiva (EVOLUTION_LINES[].id). Nunca renomear.
  "lineId"    text not null,
  -- Dex id da eeveelution escolhida. Null em toda linha que nao seja a do Eevee.
  "branchId"  integer,
  "xp"        integer not null default 0,
  -- O que aparece na mesa. O estagio NAO e coluna: e derivado do xp.
  "isActive"  boolean not null default false,
  "caughtAt"  timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "trainer_pokemon_xp_nonneg" check ("xp" >= 0)
);

create index "trainer_pokemon_userId_idx" on "trainer_pokemon" ("userId");

-- No maximo UM ativo por usuario. Indice parcial em vez de regra na aplicacao:
-- e a invariante que continua valendo quando o teto de Pokemon subir.
create unique index "trainer_pokemon_active_uidx"
  on "trainer_pokemon" ("userId") where "isActive";
