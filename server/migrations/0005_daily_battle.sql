-- Batalha de cartas da captura diaria: no maximo UMA por (usuario, dia), e a
-- chave primaria e quem garante. O estado inteiro da batalha (decks, maos, HP,
-- RNG) vive em "state" para a batalha sobreviver a restart e a aba fechada.
create table "daily_battle" (
  "userId"    text not null references "user" ("id") on delete cascade,
  "day"       date not null,
  -- Set null: soltar o Pokemon depois nao apaga o historico da batalha.
  "pokemonId" text references "trainer_pokemon" ("id") on delete set null,
  "status"    text not null default 'active',
  -- Pontos somados a chance de captura. So > 0 quando "status" = 'won'.
  "bonus"     integer not null default 0,
  "xpGained"  integer not null default 0,
  "state"     jsonb not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  primary key ("userId", "day"),
  constraint "daily_battle_status" check ("status" in ('active', 'won', 'lost')),
  constraint "daily_battle_bonus_range" check ("bonus" between 0 and 50)
);
