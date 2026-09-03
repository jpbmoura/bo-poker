/**
 * Fiação do cache de treinadores.
 *
 * O singleton mora AQUI e não no `trainerCache.ts` de propósito: aquele arquivo
 * é puro e testável sem banco, e importar o store lá dentro faria o teste de
 * unidade puxar `auth.ts` -> `config.ts`, que exige DATABASE_URL no ambiente.
 */
import * as trainerStore from './trainerStore.js';
import { TrainerCacheImpl } from './trainerCache.js';

export const TrainerCache = new TrainerCacheImpl(trainerStore);

export { TrainerCacheImpl } from './trainerCache.js';
export type { PokemonState, TrainerState, TrainerStorePort } from './trainerCache.js';
export * from './species.js';
export * as trainerStore from './trainerStore.js';
