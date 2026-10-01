-- "Quem e esse Pokemon?": UM palpite por (usuario, dia), e a chave primaria e
-- quem garante. O Pokemon do dia nao e gravado: sai do sorteio deterministico.
create table "daily_guess" (
  "userId"    text not null references "user" ("id") on delete cascade,
  "day"       date not null,
  "guess"     text not null,
  "correct"   boolean not null,
  -- XP creditado em CADA Pokemon da colecao. So > 0 quando "correct".
  "xpGained"  integer not null default 0,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  primary key ("userId", "day")
);
