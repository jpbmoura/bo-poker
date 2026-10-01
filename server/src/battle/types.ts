/** Os 18 tipos (tabela da Gen 6+, com Fada). */
export type TypeName =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

/** Stats com estágio (-6..+6). `acc`/`eva` usam a escala de precisão. */
export type StatKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';

/** Status "principal": só um por vez, persiste até curar. */
export type Ailment = 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison' | 'toxic';

/** O que um golpe pode causar. Confusão é volátil e convive com o status. */
export type MoveAilment = Ailment | 'confusion';

export interface MoveEffect {
  ailment?: MoveAilment;
  /** % de causar o ailment. Golpes de status: 100. */
  ailmentChance?: number;
  /** Variação por stat (ex.: `{ atk: 2 }` no Swords Dance). */
  stats?: Partial<Record<StatKey, number>>;
  statTarget?: 'self' | 'foe';
  statChance?: number;
  /** % do HP máximo curado (Recover = 50). */
  heal?: number;
  /** % do dano causado devolvido como HP (Giga Drain = 50). */
  drain?: number;
}

export type MoveCategory = 'physical' | 'special' | 'status';

export interface MoveData {
  id: number;
  name: string;
  type: TypeName;
  category: MoveCategory;
  /** 0 em golpe de status. */
  power: number;
  /** 0 = nunca erra. */
  accuracy: number;
  priority: number;
  effect?: MoveEffect;
}

export interface BattleSpecies {
  types: TypeName[];
  /** [hp, atk, def, spa, spd, spe] */
  stats: number[];
  /** [[moveId, nível em que aprende], …] em ordem de nível. */
  learnset: [number, number][];
}
