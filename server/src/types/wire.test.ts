import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Arquivos duplicados de propósito entre os pacotes, em vez de um pacote
 * `shared` (que não se paga num app deste tamanho). Cada par é comparado byte a
 * byte; se divergir, o build quebra aqui em vez de silenciosamente no meio de
 * uma rodada.
 *
 * Caminhos relativos a ESTE arquivo (server/src/types/).
 */
const MIRRORED: Array<{ label: string; server: string; client: string }> = [
  {
    label: 'wire.ts',
    server: './wire.ts',
    client: '../../../client/src/types/wire.ts',
  },
  {
    label: 'data/pokedex.ts',
    server: '../data/pokedex.ts',
    client: '../../../client/src/data/pokedex.ts',
  },
];

for (const { label, server, client } of MIRRORED) {
  test(`${label} é byte-idêntico entre client e server`, () => {
    const fromServer = readFileSync(new URL(server, import.meta.url), 'utf8');
    const fromClient = readFileSync(new URL(client, import.meta.url), 'utf8');
    assert.equal(
      fromServer,
      fromClient,
      `${label} divergiu entre os pacotes — copie um arquivo por cima do outro`,
    );
  });
}
