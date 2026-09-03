create table "room" ("id" text not null primary key, "name" text not null, "ownerId" text not null references "user" ("id") on delete cascade, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "room_favorite" ("roomId" text not null references "room" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, primary key ("roomId", "userId"));

create index "room_ownerId_idx" on "room" ("ownerId");

create index "room_favorite_userId_idx" on "room_favorite" ("userId");
