import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('wire.ts é byte-idêntico entre client e server', () => {
  const server = readFileSync(new URL('./wire.ts', import.meta.url), 'utf8');
  const client = readFileSync(
    new URL('../../../client/src/types/wire.ts', import.meta.url),
    'utf8',
  );
  assert.equal(
    server,
    client,
    'os tipos de wire divergiram — copie um arquivo por cima do outro',
  );
});
