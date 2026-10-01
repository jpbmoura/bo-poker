// SYNC: este arquivo DEVE ser byte-idêntico em client/src/data/pokedex.ts e
// server/src/data/pokedex.ts. Garantido por server/src/types/wire.test.ts.
// Mantenha-o SEM imports para que a exigência de extensão .js do servidor
// nunca se aplique e a comparação literal continue válida.

/** Uma forma concreta: id da national dex + nome de exibição. */
export interface DexEntry {
  id: number;
  name: string;
}

/** Raridade de uma espécie selvagem. Define a chance de captura e a de aparecer. */
export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Uma linha evolutiva. `id` é um slug estável que vai para o banco (coluna
 * `lineId`) — NUNCA renomear, seria uma migração de dados.
 *
 * `gen` é a geração de origem. Nas linhas iniciais ela só agrupa a tela de
 * escolha; as duas curingas usam `gen: 0` ("Especiais") de propósito: Pichu é
 * tecnicamente de Gen 2 e Eevee de Gen 1, mas nenhum dos dois é um inicial.
 */
export interface EvolutionLine {
  id: string;
  gen: number;
  /** Parte linear da linha. Índice = estágio. */
  stages: DexEntry[];
  /**
   * Linhas ramificadas: cada ramo é o CAMINHO que falta depois do último
   * `stages` (Eevee: `[[Vaporeon], …]`; Wurmple: `[[Silcoon, Beautifly], …]`).
   * O ramo é identificado no banco (`branchId`) pelo dex id da 1ª forma dele.
   */
  branches?: DexEntry[][];
  /** Lendário ou mítico. */
  legendary?: boolean;
  /** Pseudo-lendário: sobe um tier. */
  pseudo?: boolean;
  /** Sobrescreve o tier calculado, para qualquer estágio da linha. */
  rarity?: Tier;
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

/** Slug da linha do Eevee, a curinga ramificada da escolha inicial. */
export const EEVEE_LINE_ID = 'eevee';

/**
 * XP acumulado necessário para cada estágio. O índice É o estágio, então o
 * estágio nunca é persistido — é sempre derivado daqui. Ver `derivedStage`.
 */
export const XP_THRESHOLDS: number[] = [0, 250, 650];

/**
 * Maior dex id que aparece na natureza (captura diária). Hoje Gen 1–3. Para
 * expandir: subir este número e rodar `node scripts/gen-wild-dex.mjs`.
 */
export const WILD_MAX_DEX = 386;

/** Tentativas de captura por dia. */
export const CAPTURE_ATTEMPTS = 3;

/** Ordem crescente de raridade. */
export const TIERS: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Chance (%) de cada tentativa de captura dar certo. */
export const CAPTURE_CHANCE: Record<Tier, number> = {
  common: 60,
  uncommon: 45,
  rare: 30,
  epic: 15,
  legendary: 5,
};

/**
 * XP que um repetido capturado dá ao Pokémon da linhagem que a pessoa já tem.
 * Em vez de um segundo exemplar, a captura vira progresso.
 */
export const DUPLICATE_XP: Record<Tier, number> = {
  common: 30,
  uncommon: 50,
  rare: 80,
  epic: 120,
  legendary: 200,
};

/** Peso relativo de cada tier no sorteio do Pokémon do dia. */
export const SPAWN_WEIGHT: Record<Tier, number> = {
  common: 40,
  uncommon: 28,
  rare: 18,
  epic: 10,
  legendary: 4,
};

export const TIER_LABEL: Record<Tier, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

/** As linhas da tela de escolha do inicial. Só daqui se escolhe de graça. */
export const STARTER_LINES: EvolutionLine[] = [
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
      [{ id: 134, name: 'Vaporeon' }], [{ id: 135, name: 'Jolteon' }],
      [{ id: 136, name: 'Flareon' }], [{ id: 196, name: 'Espeon' }],
      [{ id: 197, name: 'Umbreon' }], [{ id: 470, name: 'Leafeon' }],
      [{ id: 471, name: 'Glaceon' }], [{ id: 700, name: 'Sylveon' }],
    ] },
];

// BEGIN WILD_LINES
// Gerado por scripts/gen-wild-dex.mjs (dex <= 386). Não editar à mão.
export const WILD_LINES: EvolutionLine[] = [
  { id: 'caterpie', gen: 1,
    stages: [{ id: 10, name: "Caterpie" }, { id: 11, name: "Metapod" }, { id: 12, name: "Butterfree" }] },
  { id: 'weedle', gen: 1,
    stages: [{ id: 13, name: "Weedle" }, { id: 14, name: "Kakuna" }, { id: 15, name: "Beedrill" }] },
  { id: 'pidgey', gen: 1,
    stages: [{ id: 16, name: "Pidgey" }, { id: 17, name: "Pidgeotto" }, { id: 18, name: "Pidgeot" }] },
  { id: 'rattata', gen: 1,
    stages: [{ id: 19, name: "Rattata" }, { id: 20, name: "Raticate" }] },
  { id: 'spearow', gen: 1,
    stages: [{ id: 21, name: "Spearow" }, { id: 22, name: "Fearow" }] },
  { id: 'ekans', gen: 1,
    stages: [{ id: 23, name: "Ekans" }, { id: 24, name: "Arbok" }] },
  { id: 'sandshrew', gen: 1,
    stages: [{ id: 27, name: "Sandshrew" }, { id: 28, name: "Sandslash" }] },
  { id: 'nidoran-f', gen: 1,
    stages: [{ id: 29, name: "Nidoran♀" }, { id: 30, name: "Nidorina" }, { id: 31, name: "Nidoqueen" }] },
  { id: 'nidoran-m', gen: 1,
    stages: [{ id: 32, name: "Nidoran♂" }, { id: 33, name: "Nidorino" }, { id: 34, name: "Nidoking" }] },
  { id: 'vulpix', gen: 1,
    stages: [{ id: 37, name: "Vulpix" }, { id: 38, name: "Ninetales" }] },
  { id: 'zubat', gen: 1,
    stages: [{ id: 41, name: "Zubat" }, { id: 42, name: "Golbat" }, { id: 169, name: "Crobat" }] },
  { id: 'oddish', gen: 1,
    stages: [{ id: 43, name: "Oddish" }, { id: 44, name: "Gloom" }],
    branches: [[{ id: 45, name: "Vileplume" }], [{ id: 182, name: "Bellossom" }]] },
  { id: 'paras', gen: 1,
    stages: [{ id: 46, name: "Paras" }, { id: 47, name: "Parasect" }] },
  { id: 'venonat', gen: 1,
    stages: [{ id: 48, name: "Venonat" }, { id: 49, name: "Venomoth" }] },
  { id: 'diglett', gen: 1,
    stages: [{ id: 50, name: "Diglett" }, { id: 51, name: "Dugtrio" }] },
  { id: 'meowth', gen: 1,
    stages: [{ id: 52, name: "Meowth" }, { id: 53, name: "Persian" }] },
  { id: 'psyduck', gen: 1,
    stages: [{ id: 54, name: "Psyduck" }, { id: 55, name: "Golduck" }] },
  { id: 'mankey', gen: 1,
    stages: [{ id: 56, name: "Mankey" }, { id: 57, name: "Primeape" }] },
  { id: 'growlithe', gen: 1,
    stages: [{ id: 58, name: "Growlithe" }, { id: 59, name: "Arcanine" }] },
  { id: 'poliwag', gen: 1,
    stages: [{ id: 60, name: "Poliwag" }, { id: 61, name: "Poliwhirl" }],
    branches: [[{ id: 62, name: "Poliwrath" }], [{ id: 186, name: "Politoed" }]] },
  { id: 'abra', gen: 1,
    stages: [{ id: 63, name: "Abra" }, { id: 64, name: "Kadabra" }, { id: 65, name: "Alakazam" }] },
  { id: 'machop', gen: 1,
    stages: [{ id: 66, name: "Machop" }, { id: 67, name: "Machoke" }, { id: 68, name: "Machamp" }] },
  { id: 'bellsprout', gen: 1,
    stages: [{ id: 69, name: "Bellsprout" }, { id: 70, name: "Weepinbell" }, { id: 71, name: "Victreebel" }] },
  { id: 'tentacool', gen: 1,
    stages: [{ id: 72, name: "Tentacool" }, { id: 73, name: "Tentacruel" }] },
  { id: 'geodude', gen: 1,
    stages: [{ id: 74, name: "Geodude" }, { id: 75, name: "Graveler" }, { id: 76, name: "Golem" }] },
  { id: 'ponyta', gen: 1,
    stages: [{ id: 77, name: "Ponyta" }, { id: 78, name: "Rapidash" }] },
  { id: 'slowpoke', gen: 1,
    stages: [{ id: 79, name: "Slowpoke" }],
    branches: [[{ id: 80, name: "Slowbro" }], [{ id: 199, name: "Slowking" }]] },
  { id: 'magnemite', gen: 1,
    stages: [{ id: 81, name: "Magnemite" }, { id: 82, name: "Magneton" }] },
  { id: 'farfetchd', gen: 1,
    stages: [{ id: 83, name: "Farfetch’d" }] },
  { id: 'doduo', gen: 1,
    stages: [{ id: 84, name: "Doduo" }, { id: 85, name: "Dodrio" }] },
  { id: 'seel', gen: 1,
    stages: [{ id: 86, name: "Seel" }, { id: 87, name: "Dewgong" }] },
  { id: 'grimer', gen: 1,
    stages: [{ id: 88, name: "Grimer" }, { id: 89, name: "Muk" }] },
  { id: 'shellder', gen: 1,
    stages: [{ id: 90, name: "Shellder" }, { id: 91, name: "Cloyster" }] },
  { id: 'gastly', gen: 1,
    stages: [{ id: 92, name: "Gastly" }, { id: 93, name: "Haunter" }, { id: 94, name: "Gengar" }] },
  { id: 'onix', gen: 1,
    stages: [{ id: 95, name: "Onix" }, { id: 208, name: "Steelix" }] },
  { id: 'drowzee', gen: 1,
    stages: [{ id: 96, name: "Drowzee" }, { id: 97, name: "Hypno" }] },
  { id: 'krabby', gen: 1,
    stages: [{ id: 98, name: "Krabby" }, { id: 99, name: "Kingler" }] },
  { id: 'voltorb', gen: 1,
    stages: [{ id: 100, name: "Voltorb" }, { id: 101, name: "Electrode" }] },
  { id: 'exeggcute', gen: 1,
    stages: [{ id: 102, name: "Exeggcute" }, { id: 103, name: "Exeggutor" }] },
  { id: 'cubone', gen: 1,
    stages: [{ id: 104, name: "Cubone" }, { id: 105, name: "Marowak" }] },
  { id: 'lickitung', gen: 1,
    stages: [{ id: 108, name: "Lickitung" }] },
  { id: 'koffing', gen: 1,
    stages: [{ id: 109, name: "Koffing" }, { id: 110, name: "Weezing" }] },
  { id: 'rhyhorn', gen: 1,
    stages: [{ id: 111, name: "Rhyhorn" }, { id: 112, name: "Rhydon" }] },
  { id: 'chansey', gen: 1,
    stages: [{ id: 113, name: "Chansey" }, { id: 242, name: "Blissey" }] },
  { id: 'tangela', gen: 1,
    stages: [{ id: 114, name: "Tangela" }] },
  { id: 'kangaskhan', gen: 1,
    stages: [{ id: 115, name: "Kangaskhan" }] },
  { id: 'horsea', gen: 1,
    stages: [{ id: 116, name: "Horsea" }, { id: 117, name: "Seadra" }, { id: 230, name: "Kingdra" }] },
  { id: 'goldeen', gen: 1,
    stages: [{ id: 118, name: "Goldeen" }, { id: 119, name: "Seaking" }] },
  { id: 'staryu', gen: 1,
    stages: [{ id: 120, name: "Staryu" }, { id: 121, name: "Starmie" }] },
  { id: 'mr-mime', gen: 1,
    stages: [{ id: 122, name: "Mr. Mime" }] },
  { id: 'scyther', gen: 1,
    stages: [{ id: 123, name: "Scyther" }, { id: 212, name: "Scizor" }] },
  { id: 'pinsir', gen: 1,
    stages: [{ id: 127, name: "Pinsir" }] },
  { id: 'tauros', gen: 1,
    stages: [{ id: 128, name: "Tauros" }] },
  { id: 'magikarp', gen: 1,
    stages: [{ id: 129, name: "Magikarp" }, { id: 130, name: "Gyarados" }] },
  { id: 'lapras', gen: 1,
    stages: [{ id: 131, name: "Lapras" }] },
  { id: 'ditto', gen: 1,
    stages: [{ id: 132, name: "Ditto" }] },
  { id: 'porygon', gen: 1,
    stages: [{ id: 137, name: "Porygon" }, { id: 233, name: "Porygon2" }] },
  { id: 'omanyte', gen: 1,
    stages: [{ id: 138, name: "Omanyte" }, { id: 139, name: "Omastar" }] },
  { id: 'kabuto', gen: 1,
    stages: [{ id: 140, name: "Kabuto" }, { id: 141, name: "Kabutops" }] },
  { id: 'aerodactyl', gen: 1,
    stages: [{ id: 142, name: "Aerodactyl" }] },
  { id: 'snorlax', gen: 1,
    stages: [{ id: 143, name: "Snorlax" }] },
  { id: 'articuno', gen: 1, legendary: true,
    stages: [{ id: 144, name: "Articuno" }] },
  { id: 'zapdos', gen: 1, legendary: true,
    stages: [{ id: 145, name: "Zapdos" }] },
  { id: 'moltres', gen: 1, legendary: true,
    stages: [{ id: 146, name: "Moltres" }] },
  { id: 'dratini', gen: 1, pseudo: true,
    stages: [{ id: 147, name: "Dratini" }, { id: 148, name: "Dragonair" }, { id: 149, name: "Dragonite" }] },
  { id: 'mewtwo', gen: 1, legendary: true,
    stages: [{ id: 150, name: "Mewtwo" }] },
  { id: 'mew', gen: 1, legendary: true,
    stages: [{ id: 151, name: "Mew" }] },
  { id: 'sentret', gen: 2,
    stages: [{ id: 161, name: "Sentret" }, { id: 162, name: "Furret" }] },
  { id: 'hoothoot', gen: 2,
    stages: [{ id: 163, name: "Hoothoot" }, { id: 164, name: "Noctowl" }] },
  { id: 'ledyba', gen: 2,
    stages: [{ id: 165, name: "Ledyba" }, { id: 166, name: "Ledian" }] },
  { id: 'spinarak', gen: 2,
    stages: [{ id: 167, name: "Spinarak" }, { id: 168, name: "Ariados" }] },
  { id: 'chinchou', gen: 2,
    stages: [{ id: 170, name: "Chinchou" }, { id: 171, name: "Lanturn" }] },
  { id: 'cleffa', gen: 2,
    stages: [{ id: 173, name: "Cleffa" }, { id: 35, name: "Clefairy" }, { id: 36, name: "Clefable" }] },
  { id: 'igglybuff', gen: 2,
    stages: [{ id: 174, name: "Igglybuff" }, { id: 39, name: "Jigglypuff" }, { id: 40, name: "Wigglytuff" }] },
  { id: 'togepi', gen: 2,
    stages: [{ id: 175, name: "Togepi" }, { id: 176, name: "Togetic" }] },
  { id: 'natu', gen: 2,
    stages: [{ id: 177, name: "Natu" }, { id: 178, name: "Xatu" }] },
  { id: 'mareep', gen: 2,
    stages: [{ id: 179, name: "Mareep" }, { id: 180, name: "Flaaffy" }, { id: 181, name: "Ampharos" }] },
  { id: 'sudowoodo', gen: 2,
    stages: [{ id: 185, name: "Sudowoodo" }] },
  { id: 'hoppip', gen: 2,
    stages: [{ id: 187, name: "Hoppip" }, { id: 188, name: "Skiploom" }, { id: 189, name: "Jumpluff" }] },
  { id: 'aipom', gen: 2,
    stages: [{ id: 190, name: "Aipom" }] },
  { id: 'sunkern', gen: 2,
    stages: [{ id: 191, name: "Sunkern" }, { id: 192, name: "Sunflora" }] },
  { id: 'yanma', gen: 2,
    stages: [{ id: 193, name: "Yanma" }] },
  { id: 'wooper', gen: 2,
    stages: [{ id: 194, name: "Wooper" }, { id: 195, name: "Quagsire" }] },
  { id: 'murkrow', gen: 2,
    stages: [{ id: 198, name: "Murkrow" }] },
  { id: 'misdreavus', gen: 2,
    stages: [{ id: 200, name: "Misdreavus" }] },
  { id: 'unown', gen: 2,
    stages: [{ id: 201, name: "Unown" }] },
  { id: 'girafarig', gen: 2,
    stages: [{ id: 203, name: "Girafarig" }] },
  { id: 'pineco', gen: 2,
    stages: [{ id: 204, name: "Pineco" }, { id: 205, name: "Forretress" }] },
  { id: 'dunsparce', gen: 2,
    stages: [{ id: 206, name: "Dunsparce" }] },
  { id: 'gligar', gen: 2,
    stages: [{ id: 207, name: "Gligar" }] },
  { id: 'snubbull', gen: 2,
    stages: [{ id: 209, name: "Snubbull" }, { id: 210, name: "Granbull" }] },
  { id: 'qwilfish', gen: 2,
    stages: [{ id: 211, name: "Qwilfish" }] },
  { id: 'shuckle', gen: 2,
    stages: [{ id: 213, name: "Shuckle" }] },
  { id: 'heracross', gen: 2,
    stages: [{ id: 214, name: "Heracross" }] },
  { id: 'sneasel', gen: 2,
    stages: [{ id: 215, name: "Sneasel" }] },
  { id: 'teddiursa', gen: 2,
    stages: [{ id: 216, name: "Teddiursa" }, { id: 217, name: "Ursaring" }] },
  { id: 'slugma', gen: 2,
    stages: [{ id: 218, name: "Slugma" }, { id: 219, name: "Magcargo" }] },
  { id: 'swinub', gen: 2,
    stages: [{ id: 220, name: "Swinub" }, { id: 221, name: "Piloswine" }] },
  { id: 'corsola', gen: 2,
    stages: [{ id: 222, name: "Corsola" }] },
  { id: 'remoraid', gen: 2,
    stages: [{ id: 223, name: "Remoraid" }, { id: 224, name: "Octillery" }] },
  { id: 'delibird', gen: 2,
    stages: [{ id: 225, name: "Delibird" }] },
  { id: 'mantine', gen: 2,
    stages: [{ id: 226, name: "Mantine" }] },
  { id: 'skarmory', gen: 2,
    stages: [{ id: 227, name: "Skarmory" }] },
  { id: 'houndour', gen: 2,
    stages: [{ id: 228, name: "Houndour" }, { id: 229, name: "Houndoom" }] },
  { id: 'phanpy', gen: 2,
    stages: [{ id: 231, name: "Phanpy" }, { id: 232, name: "Donphan" }] },
  { id: 'stantler', gen: 2,
    stages: [{ id: 234, name: "Stantler" }] },
  { id: 'smeargle', gen: 2,
    stages: [{ id: 235, name: "Smeargle" }] },
  { id: 'tyrogue', gen: 2,
    stages: [{ id: 236, name: "Tyrogue" }],
    branches: [[{ id: 106, name: "Hitmonlee" }], [{ id: 107, name: "Hitmonchan" }], [{ id: 237, name: "Hitmontop" }]] },
  { id: 'smoochum', gen: 2,
    stages: [{ id: 238, name: "Smoochum" }, { id: 124, name: "Jynx" }] },
  { id: 'elekid', gen: 2,
    stages: [{ id: 239, name: "Elekid" }, { id: 125, name: "Electabuzz" }] },
  { id: 'magby', gen: 2,
    stages: [{ id: 240, name: "Magby" }, { id: 126, name: "Magmar" }] },
  { id: 'miltank', gen: 2,
    stages: [{ id: 241, name: "Miltank" }] },
  { id: 'raikou', gen: 2, legendary: true,
    stages: [{ id: 243, name: "Raikou" }] },
  { id: 'entei', gen: 2, legendary: true,
    stages: [{ id: 244, name: "Entei" }] },
  { id: 'suicune', gen: 2, legendary: true,
    stages: [{ id: 245, name: "Suicune" }] },
  { id: 'larvitar', gen: 2, pseudo: true,
    stages: [{ id: 246, name: "Larvitar" }, { id: 247, name: "Pupitar" }, { id: 248, name: "Tyranitar" }] },
  { id: 'lugia', gen: 2, legendary: true,
    stages: [{ id: 249, name: "Lugia" }] },
  { id: 'ho-oh', gen: 2, legendary: true,
    stages: [{ id: 250, name: "Ho-Oh" }] },
  { id: 'celebi', gen: 2, legendary: true,
    stages: [{ id: 251, name: "Celebi" }] },
  { id: 'poochyena', gen: 3,
    stages: [{ id: 261, name: "Poochyena" }, { id: 262, name: "Mightyena" }] },
  { id: 'zigzagoon', gen: 3,
    stages: [{ id: 263, name: "Zigzagoon" }, { id: 264, name: "Linoone" }] },
  { id: 'wurmple', gen: 3,
    stages: [{ id: 265, name: "Wurmple" }],
    branches: [[{ id: 266, name: "Silcoon" }, { id: 267, name: "Beautifly" }], [{ id: 268, name: "Cascoon" }, { id: 269, name: "Dustox" }]] },
  { id: 'lotad', gen: 3,
    stages: [{ id: 270, name: "Lotad" }, { id: 271, name: "Lombre" }, { id: 272, name: "Ludicolo" }] },
  { id: 'seedot', gen: 3,
    stages: [{ id: 273, name: "Seedot" }, { id: 274, name: "Nuzleaf" }, { id: 275, name: "Shiftry" }] },
  { id: 'taillow', gen: 3,
    stages: [{ id: 276, name: "Taillow" }, { id: 277, name: "Swellow" }] },
  { id: 'wingull', gen: 3,
    stages: [{ id: 278, name: "Wingull" }, { id: 279, name: "Pelipper" }] },
  { id: 'ralts', gen: 3,
    stages: [{ id: 280, name: "Ralts" }, { id: 281, name: "Kirlia" }, { id: 282, name: "Gardevoir" }] },
  { id: 'surskit', gen: 3,
    stages: [{ id: 283, name: "Surskit" }, { id: 284, name: "Masquerain" }] },
  { id: 'shroomish', gen: 3,
    stages: [{ id: 285, name: "Shroomish" }, { id: 286, name: "Breloom" }] },
  { id: 'slakoth', gen: 3,
    stages: [{ id: 287, name: "Slakoth" }, { id: 288, name: "Vigoroth" }, { id: 289, name: "Slaking" }] },
  { id: 'nincada', gen: 3,
    stages: [{ id: 290, name: "Nincada" }],
    branches: [[{ id: 291, name: "Ninjask" }], [{ id: 292, name: "Shedinja" }]] },
  { id: 'whismur', gen: 3,
    stages: [{ id: 293, name: "Whismur" }, { id: 294, name: "Loudred" }, { id: 295, name: "Exploud" }] },
  { id: 'makuhita', gen: 3,
    stages: [{ id: 296, name: "Makuhita" }, { id: 297, name: "Hariyama" }] },
  { id: 'azurill', gen: 3,
    stages: [{ id: 298, name: "Azurill" }, { id: 183, name: "Marill" }, { id: 184, name: "Azumarill" }] },
  { id: 'nosepass', gen: 3,
    stages: [{ id: 299, name: "Nosepass" }] },
  { id: 'skitty', gen: 3,
    stages: [{ id: 300, name: "Skitty" }, { id: 301, name: "Delcatty" }] },
  { id: 'sableye', gen: 3,
    stages: [{ id: 302, name: "Sableye" }] },
  { id: 'mawile', gen: 3,
    stages: [{ id: 303, name: "Mawile" }] },
  { id: 'aron', gen: 3,
    stages: [{ id: 304, name: "Aron" }, { id: 305, name: "Lairon" }, { id: 306, name: "Aggron" }] },
  { id: 'meditite', gen: 3,
    stages: [{ id: 307, name: "Meditite" }, { id: 308, name: "Medicham" }] },
  { id: 'electrike', gen: 3,
    stages: [{ id: 309, name: "Electrike" }, { id: 310, name: "Manectric" }] },
  { id: 'plusle', gen: 3,
    stages: [{ id: 311, name: "Plusle" }] },
  { id: 'minun', gen: 3,
    stages: [{ id: 312, name: "Minun" }] },
  { id: 'volbeat', gen: 3,
    stages: [{ id: 313, name: "Volbeat" }] },
  { id: 'illumise', gen: 3,
    stages: [{ id: 314, name: "Illumise" }] },
  { id: 'roselia', gen: 3,
    stages: [{ id: 315, name: "Roselia" }] },
  { id: 'gulpin', gen: 3,
    stages: [{ id: 316, name: "Gulpin" }, { id: 317, name: "Swalot" }] },
  { id: 'carvanha', gen: 3,
    stages: [{ id: 318, name: "Carvanha" }, { id: 319, name: "Sharpedo" }] },
  { id: 'wailmer', gen: 3,
    stages: [{ id: 320, name: "Wailmer" }, { id: 321, name: "Wailord" }] },
  { id: 'numel', gen: 3,
    stages: [{ id: 322, name: "Numel" }, { id: 323, name: "Camerupt" }] },
  { id: 'torkoal', gen: 3,
    stages: [{ id: 324, name: "Torkoal" }] },
  { id: 'spoink', gen: 3,
    stages: [{ id: 325, name: "Spoink" }, { id: 326, name: "Grumpig" }] },
  { id: 'spinda', gen: 3,
    stages: [{ id: 327, name: "Spinda" }] },
  { id: 'trapinch', gen: 3,
    stages: [{ id: 328, name: "Trapinch" }, { id: 329, name: "Vibrava" }, { id: 330, name: "Flygon" }] },
  { id: 'cacnea', gen: 3,
    stages: [{ id: 331, name: "Cacnea" }, { id: 332, name: "Cacturne" }] },
  { id: 'swablu', gen: 3,
    stages: [{ id: 333, name: "Swablu" }, { id: 334, name: "Altaria" }] },
  { id: 'zangoose', gen: 3,
    stages: [{ id: 335, name: "Zangoose" }] },
  { id: 'seviper', gen: 3,
    stages: [{ id: 336, name: "Seviper" }] },
  { id: 'lunatone', gen: 3,
    stages: [{ id: 337, name: "Lunatone" }] },
  { id: 'solrock', gen: 3,
    stages: [{ id: 338, name: "Solrock" }] },
  { id: 'barboach', gen: 3,
    stages: [{ id: 339, name: "Barboach" }, { id: 340, name: "Whiscash" }] },
  { id: 'corphish', gen: 3,
    stages: [{ id: 341, name: "Corphish" }, { id: 342, name: "Crawdaunt" }] },
  { id: 'baltoy', gen: 3,
    stages: [{ id: 343, name: "Baltoy" }, { id: 344, name: "Claydol" }] },
  { id: 'lileep', gen: 3,
    stages: [{ id: 345, name: "Lileep" }, { id: 346, name: "Cradily" }] },
  { id: 'anorith', gen: 3,
    stages: [{ id: 347, name: "Anorith" }, { id: 348, name: "Armaldo" }] },
  { id: 'feebas', gen: 3,
    stages: [{ id: 349, name: "Feebas" }, { id: 350, name: "Milotic" }] },
  { id: 'castform', gen: 3,
    stages: [{ id: 351, name: "Castform" }] },
  { id: 'kecleon', gen: 3,
    stages: [{ id: 352, name: "Kecleon" }] },
  { id: 'shuppet', gen: 3,
    stages: [{ id: 353, name: "Shuppet" }, { id: 354, name: "Banette" }] },
  { id: 'duskull', gen: 3,
    stages: [{ id: 355, name: "Duskull" }, { id: 356, name: "Dusclops" }] },
  { id: 'tropius', gen: 3,
    stages: [{ id: 357, name: "Tropius" }] },
  { id: 'chimecho', gen: 3,
    stages: [{ id: 358, name: "Chimecho" }] },
  { id: 'absol', gen: 3,
    stages: [{ id: 359, name: "Absol" }] },
  { id: 'wynaut', gen: 3,
    stages: [{ id: 360, name: "Wynaut" }, { id: 202, name: "Wobbuffet" }] },
  { id: 'snorunt', gen: 3,
    stages: [{ id: 361, name: "Snorunt" }, { id: 362, name: "Glalie" }] },
  { id: 'spheal', gen: 3,
    stages: [{ id: 363, name: "Spheal" }, { id: 364, name: "Sealeo" }, { id: 365, name: "Walrein" }] },
  { id: 'clamperl', gen: 3,
    stages: [{ id: 366, name: "Clamperl" }],
    branches: [[{ id: 367, name: "Huntail" }], [{ id: 368, name: "Gorebyss" }]] },
  { id: 'relicanth', gen: 3,
    stages: [{ id: 369, name: "Relicanth" }] },
  { id: 'luvdisc', gen: 3,
    stages: [{ id: 370, name: "Luvdisc" }] },
  { id: 'bagon', gen: 3, pseudo: true,
    stages: [{ id: 371, name: "Bagon" }, { id: 372, name: "Shelgon" }, { id: 373, name: "Salamence" }] },
  { id: 'beldum', gen: 3, pseudo: true,
    stages: [{ id: 374, name: "Beldum" }, { id: 375, name: "Metang" }, { id: 376, name: "Metagross" }] },
  { id: 'regirock', gen: 3, legendary: true,
    stages: [{ id: 377, name: "Regirock" }] },
  { id: 'regice', gen: 3, legendary: true,
    stages: [{ id: 378, name: "Regice" }] },
  { id: 'registeel', gen: 3, legendary: true,
    stages: [{ id: 379, name: "Registeel" }] },
  { id: 'latias', gen: 3, legendary: true,
    stages: [{ id: 380, name: "Latias" }] },
  { id: 'latios', gen: 3, legendary: true,
    stages: [{ id: 381, name: "Latios" }] },
  { id: 'kyogre', gen: 3, legendary: true,
    stages: [{ id: 382, name: "Kyogre" }] },
  { id: 'groudon', gen: 3, legendary: true,
    stages: [{ id: 383, name: "Groudon" }] },
  { id: 'rayquaza', gen: 3, legendary: true,
    stages: [{ id: 384, name: "Rayquaza" }] },
  { id: 'jirachi', gen: 3, legendary: true,
    stages: [{ id: 385, name: "Jirachi" }] },
  { id: 'deoxys', gen: 3, legendary: true,
    stages: [{ id: 386, name: "Deoxys" }] },
];
// END WILD_LINES

/** Todo o catálogo: iniciais + as linhas que só se ganha capturando. */
export const EVOLUTION_LINES: EvolutionLine[] = [...STARTER_LINES, ...WILD_LINES];

const LINE_BY_ID = new Map(EVOLUTION_LINES.map((line) => [line.id, line]));

export function findLine(lineId: string): EvolutionLine | null {
  return LINE_BY_ID.get(lineId) ?? null;
}

export function isValidLineId(lineId: string): boolean {
  return LINE_BY_ID.has(lineId);
}

export function isStarterLine(lineId: string): boolean {
  return STARTER_LINES.some((line) => line.id === lineId);
}

/**
 * Maior estágio alcançável na linha. Linear: `stages.length - 1`. Ramificada:
 * soma o comprimento dos ramos (Eevee: 0 + 1 = 1; Wurmple: 0 + 2 = 2). É o
 * teto que faz os limiares além dele serem no-op.
 */
export function maxStage(line: EvolutionLine): number {
  return line.stages.length - 1 + (line.branches?.[0]?.length ?? 0);
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

/** O ramo cujo 1º dex id é `dexId`, ou null. */
export function findBranch(line: EvolutionLine, dexId: number): DexEntry[] | null {
  for (const branch of line.branches ?? []) {
    if (branch[0]?.id === dexId) return branch;
  }
  return null;
}

/**
 * A forma exibida. Recebe o estágio EXPLICITAMENTE em vez de derivá-lo do XP:
 * a mesa mostra uma forma ADIADA durante o reveal (senão o sprite trocaria antes
 * da animação de evolução tocar), e quem decide qual estágio mostrar é o caller.
 *
 * Linha ramificada sem ramo escolhido PERMANECE na última forma linear em
 * qualquer estágio (Eevee continua Eevee até a pedra).
 */
export function resolveForm(
  lineId: string,
  stage: number,
  branchId: number | null,
): DexEntry | null {
  const line = findLine(lineId);
  if (!line) return null;

  const linear = line.stages.length;
  if (stage < 0) return line.stages[0];
  if (stage < linear) return line.stages[stage];

  const branch = line.branches && branchId !== null ? findBranch(line, branchId) : null;
  if (!branch) return line.stages[linear - 1];
  const i = stage - linear;
  return branch[i < branch.length ? i : branch.length - 1];
}

/** XP com que nasce um Pokémon capturado já num estágio. */
export function xpForStage(stage: number): number {
  return XP_THRESHOLDS[stage] ?? 0;
}

/** Uma espécie que pode aparecer na captura diária. */
export interface WildSpecies {
  lineId: string;
  stage: number;
  /** Ramo implicado pela espécie (Beautifly -> Silcoon), ou null. */
  branchId: number | null;
  entry: DexEntry;
  tier: Tier;
}

function bumpTier(tier: Tier): Tier {
  return TIERS[Math.min(TIERS.indexOf(tier) + 1, TIERS.length - 1)];
}

/**
 * Raridade de uma espécie pela posição na linha: base Comum, meio Incomum,
 * final de 2 estágios (ou estágio único) Raro, final de 3 estágios Épico.
 * Lendários são sempre Lendário; pseudo-lendários sobem um tier.
 */
export function tierOf(line: EvolutionLine, stage: number): Tier {
  if (line.rarity) return line.rarity;
  if (line.legendary) return 'legendary';
  const max = maxStage(line);
  let tier: Tier;
  if (max === 0) tier = 'rare';
  else if (stage >= max) tier = max >= 2 ? 'epic' : 'rare';
  else if (stage === 0) tier = 'common';
  else tier = 'uncommon';
  return line.pseudo ? bumpTier(tier) : tier;
}

let wildCache: WildSpecies[] | null = null;

/** Todas as espécies da natureza (dex <= WILD_MAX_DEX), em ordem de dex. */
export function wildSpecies(): WildSpecies[] {
  if (wildCache) return wildCache;
  const out: WildSpecies[] = [];
  for (const line of EVOLUTION_LINES) {
    line.stages.forEach((entry, stage) => {
      if (entry.id <= WILD_MAX_DEX) {
        out.push({ lineId: line.id, stage, branchId: null, entry, tier: tierOf(line, stage) });
      }
    });
    for (const branch of line.branches ?? []) {
      branch.forEach((entry, i) => {
        const stage = line.stages.length + i;
        if (entry.id <= WILD_MAX_DEX) {
          out.push({ lineId: line.id, stage, branchId: branch[0].id, entry, tier: tierOf(line, stage) });
        }
      });
    }
  }
  out.sort((a, b) => a.entry.id - b.entry.id);
  wildCache = out;
  return out;
}
