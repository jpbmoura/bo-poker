// SYNC: este arquivo DEVE ser byte-idêntico em client/src/data/pokedex.ts e
// server/src/data/pokedex.ts. Garantido por server/src/types/wire.test.ts.
// Mantenha-o SEM imports para que a exigência de extensão .js do servidor
// nunca se aplique e a comparação literal continue válida.

/** Uma forma concreta: id da national dex + nome de exibição. */
export interface DexEntry {
  id: number;
  name: string;
}

/**
 * Uma linha evolutiva escolhível. `id` é um slug estável que vai para o banco
 * (coluna `lineId`) — NUNCA renomear, seria uma migração de dados.
 *
 * `gen` é a geração de origem, usada só para agrupar a tela de escolha. As duas
 * linhas curinga usam `gen: 0` ("Especiais") de propósito: Pichu é tecnicamente
 * de Gen 2 e Eevee de Gen 1, mas nenhum dos dois é um inicial, e misturá-los
 * com os iniciais das respectivas gerações confundiria a escolha.
 */
export interface EvolutionLine {
  id: string;
  gen: number;
  /** Índice = estágio. 3 entradas nas linhas normais, 1 na do Eevee. */
  stages: DexEntry[];
  /** Só a linha do Eevee: as 8 opções do estágio final. */
  branches?: DexEntry[];
}

/**
 * Sprites de todas as gerações, sem nenhuma chamada à PokéAPI em runtime — o
 * repositório de sprites serve o PNG direto pelo id da national dex.
 */
export const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}${id}.png`;
}

/** Slug da única linha ramificada. Vários caminhos precisam tratá-la à parte. */
export const EEVEE_LINE_ID = 'eevee';

/**
 * XP acumulado necessário para cada estágio. O índice É o estágio, então o
 * estágio nunca é persistido — é sempre derivado daqui. Ver `derivedStage`.
 */
export const XP_THRESHOLDS: number[] = [0, 250, 650];

/**
 * Teto de Pokémon por conta. Hoje 1: o schema, o cache e a API REST já são de
 * coleção, então destravar é subir este número e decidir COMO se ganha um novo.
 */
export const MAX_POKEMON_PER_USER = 1;

export const EVOLUTION_LINES: EvolutionLine[] = [
  { id: 'bulbasaur', gen: 1, stages: [
    { id: 1, name: 'Bulbasaur' }, { id: 2, name: 'Ivysaur' }, { id: 3, name: 'Venusaur' }] },
  { id: 'charmander', gen: 1, stages: [
    { id: 4, name: 'Charmander' }, { id: 5, name: 'Charmeleon' }, { id: 6, name: 'Charizard' }] },
  { id: 'squirtle', gen: 1, stages: [
    { id: 7, name: 'Squirtle' }, { id: 8, name: 'Wartortle' }, { id: 9, name: 'Blastoise' }] },

  { id: 'chikorita', gen: 2, stages: [
    { id: 152, name: 'Chikorita' }, { id: 153, name: 'Bayleef' }, { id: 154, name: 'Meganium' }] },
  { id: 'cyndaquil', gen: 2, stages: [
    { id: 155, name: 'Cyndaquil' }, { id: 156, name: 'Quilava' }, { id: 157, name: 'Typhlosion' }] },
  { id: 'totodile', gen: 2, stages: [
    { id: 158, name: 'Totodile' }, { id: 159, name: 'Croconaw' }, { id: 160, name: 'Feraligatr' }] },

  { id: 'treecko', gen: 3, stages: [
    { id: 252, name: 'Treecko' }, { id: 253, name: 'Grovyle' }, { id: 254, name: 'Sceptile' }] },
  { id: 'torchic', gen: 3, stages: [
    { id: 255, name: 'Torchic' }, { id: 256, name: 'Combusken' }, { id: 257, name: 'Blaziken' }] },
  { id: 'mudkip', gen: 3, stages: [
    { id: 258, name: 'Mudkip' }, { id: 259, name: 'Marshtomp' }, { id: 260, name: 'Swampert' }] },

  { id: 'turtwig', gen: 4, stages: [
    { id: 387, name: 'Turtwig' }, { id: 388, name: 'Grotle' }, { id: 389, name: 'Torterra' }] },
  { id: 'chimchar', gen: 4, stages: [
    { id: 390, name: 'Chimchar' }, { id: 391, name: 'Monferno' }, { id: 392, name: 'Infernape' }] },
  { id: 'piplup', gen: 4, stages: [
    { id: 393, name: 'Piplup' }, { id: 394, name: 'Prinplup' }, { id: 395, name: 'Empoleon' }] },

  { id: 'snivy', gen: 5, stages: [
    { id: 495, name: 'Snivy' }, { id: 496, name: 'Servine' }, { id: 497, name: 'Serperior' }] },
  { id: 'tepig', gen: 5, stages: [
    { id: 498, name: 'Tepig' }, { id: 499, name: 'Pignite' }, { id: 500, name: 'Emboar' }] },
  { id: 'oshawott', gen: 5, stages: [
    { id: 501, name: 'Oshawott' }, { id: 502, name: 'Dewott' }, { id: 503, name: 'Samurott' }] },

  { id: 'chespin', gen: 6, stages: [
    { id: 650, name: 'Chespin' }, { id: 651, name: 'Quilladin' }, { id: 652, name: 'Chesnaught' }] },
  { id: 'fennekin', gen: 6, stages: [
    { id: 653, name: 'Fennekin' }, { id: 654, name: 'Braixen' }, { id: 655, name: 'Delphox' }] },
  { id: 'froakie', gen: 6, stages: [
    { id: 656, name: 'Froakie' }, { id: 657, name: 'Frogadier' }, { id: 658, name: 'Greninja' }] },

  { id: 'rowlet', gen: 7, stages: [
    { id: 722, name: 'Rowlet' }, { id: 723, name: 'Dartrix' }, { id: 724, name: 'Decidueye' }] },
  { id: 'litten', gen: 7, stages: [
    { id: 725, name: 'Litten' }, { id: 726, name: 'Torracat' }, { id: 727, name: 'Incineroar' }] },
  { id: 'popplio', gen: 7, stages: [
    { id: 728, name: 'Popplio' }, { id: 729, name: 'Brionne' }, { id: 730, name: 'Primarina' }] },

  { id: 'grookey', gen: 8, stages: [
    { id: 810, name: 'Grookey' }, { id: 811, name: 'Thwackey' }, { id: 812, name: 'Rillaboom' }] },
  { id: 'scorbunny', gen: 8, stages: [
    { id: 813, name: 'Scorbunny' }, { id: 814, name: 'Raboot' }, { id: 815, name: 'Cinderace' }] },
  { id: 'sobble', gen: 8, stages: [
    { id: 816, name: 'Sobble' }, { id: 817, name: 'Drizzile' }, { id: 818, name: 'Inteleon' }] },

  { id: 'sprigatito', gen: 9, stages: [
    { id: 906, name: 'Sprigatito' }, { id: 907, name: 'Floragato' }, { id: 908, name: 'Meowscarada' }] },
  { id: 'fuecoco', gen: 9, stages: [
    { id: 909, name: 'Fuecoco' }, { id: 910, name: 'Crocalor' }, { id: 911, name: 'Skeledirge' }] },
  { id: 'quaxly', gen: 9, stages: [
    { id: 912, name: 'Quaxly' }, { id: 913, name: 'Quaxwell' }, { id: 914, name: 'Quaquaval' }] },

  // Curingas. Pichu vira linha de 3 estágios como qualquer outra; Eevee é a
  // única ramificada e a única de 2 estágios.
  { id: 'pichu', gen: 0, stages: [
    { id: 172, name: 'Pichu' }, { id: 25, name: 'Pikachu' }, { id: 26, name: 'Raichu' }] },
  { id: EEVEE_LINE_ID, gen: 0,
    stages: [{ id: 133, name: 'Eevee' }],
    branches: [
      { id: 134, name: 'Vaporeon' }, { id: 135, name: 'Jolteon' },
      { id: 136, name: 'Flareon' }, { id: 196, name: 'Espeon' },
      { id: 197, name: 'Umbreon' }, { id: 470, name: 'Leafeon' },
      { id: 471, name: 'Glaceon' }, { id: 700, name: 'Sylveon' },
    ] },
];

export function findLine(lineId: string): EvolutionLine | null {
  for (const line of EVOLUTION_LINES) {
    if (line.id === lineId) return line;
  }
  return null;
}

export function isValidLineId(lineId: string): boolean {
  return findLine(lineId) !== null;
}

/**
 * Maior estágio alcançável na linha: 2 nas normais (3 formas), 1 na do Eevee
 * (Eevee -> eeveelution escolhida). É o teto que faz o 3º limiar ser no-op ali.
 */
export function maxStage(line: EvolutionLine): number {
  return line.branches ? 1 : line.stages.length - 1;
}

/**
 * Estágio SÓ pelo XP, sem considerar o teto da linha. Base 0 para indexar
 * `stages` direto. Nunca é persistido: guardar estágio e XP separados só criaria
 * oportunidade de divergirem.
 */
export function derivedStage(xp: number): number {
  let stage = 0;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) stage = i;
  }
  return stage;
}

/** Estágio efetivo: o derivado do XP, limitado pelo teto da linha. */
export function stageFor(line: EvolutionLine, xp: number): number {
  const stage = derivedStage(xp);
  const max = maxStage(line);
  return stage > max ? max : stage;
}

/** XP do próximo limiar, ou null quando a linha já está no estágio final. */
export function nextThreshold(line: EvolutionLine, xp: number): number | null {
  const stage = stageFor(line, xp);
  if (stage >= maxStage(line)) return null;
  return XP_THRESHOLDS[stage + 1];
}

export function findBranch(line: EvolutionLine, dexId: number): DexEntry | null {
  for (const branch of line.branches ?? []) {
    if (branch.id === dexId) return branch;
  }
  return null;
}

/**
 * A forma exibida. Recebe o estágio EXPLICITAMENTE em vez de derivá-lo do XP:
 * a mesa mostra uma forma ADIADA durante o reveal (senão o sprite trocaria antes
 * da animação de evolução tocar), e quem decide qual estágio mostrar é o caller.
 *
 * Eevee sem pedra escolhida PERMANECE Eevee em qualquer estágio.
 */
export function resolveForm(
  lineId: string,
  stage: number,
  branchId: number | null,
): DexEntry | null {
  const line = findLine(lineId);
  if (!line) return null;

  if (line.branches) {
    if (stage < 1) return line.stages[0];
    const branch = branchId === null ? null : findBranch(line, branchId);
    return branch ?? line.stages[0];
  }

  const capped = stage < 0 ? 0 : stage > line.stages.length - 1 ? line.stages.length - 1 : stage;
  return line.stages[capped];
}
