import { mutation, request } from './api';
import type { Pokemon } from '../types';
import type { DailyCapture } from './capture';
import type { TrainerCollection } from './trainer';

/**
 * Espelho de `server/src/battle/types.ts`, `engine.ts` (eventos) e `view.ts`
 * (DTOs). O cliente não roda nada da batalha: só desenha o que o servidor
 * manda e anima os eventos na ordem em que vieram.
 */
export type TypeName =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type StatKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';
export type Ailment = 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison' | 'toxic';
export type MoveCategory = 'physical' | 'special' | 'status';
export type BattleStatus = 'active' | 'won' | 'lost';
export type Side = 'player' | 'wild';

export interface MoveEffect {
  ailment?: Ailment | 'confusion';
  ailmentChance?: number;
  stats?: Partial<Record<StatKey, number>>;
  statTarget?: 'self' | 'foe';
  statChance?: number;
  heal?: number;
  drain?: number;
}

export interface MoveView {
  id: number;
  name: string;
  type: TypeName;
  category: MoveCategory;
  power: number;
  accuracy: number;
  priority: number;
  effect: MoveEffect | null;
  effectiveness: number;
  stab: boolean;
}

export interface CardView {
  uid: string;
  move: MoveView;
}

export interface FighterView {
  dexId: number;
  name: string;
  sprite: string;
  level: number;
  types: TypeName[];
  hp: number;
  maxHp: number;
  ailment: Ailment | null;
  confused: boolean;
  stages: Partial<Record<StatKey, number>>;
}

export interface Battle {
  status: BattleStatus;
  turn: number;
  maxTurns: number;
  player: FighterView;
  wild: FighterView;
  hand: CardView[];
  deckCount: number;
  discardCount: number;
  wildHandCount: number;
  wildDeckCount: number;
  bonus: number;
  xpGained: number;
}

export type BattleEvent =
  | { kind: 'move'; side: Side; moveId: number; name: string; type: TypeName }
  | { kind: 'miss'; side: Side }
  | { kind: 'fail'; side: Side }
  | { kind: 'damage'; side: Side; amount: number; hp: number; effectiveness: number; crit: boolean }
  | { kind: 'heal'; side: Side; amount: number; hp: number }
  | { kind: 'ailment'; side: Side; ailment: Ailment }
  | { kind: 'cure'; side: Side; ailment: Ailment }
  | { kind: 'confused'; side: Side }
  | { kind: 'confusionEnd'; side: Side }
  | { kind: 'selfHit'; side: Side; amount: number; hp: number }
  | { kind: 'skip'; side: Side; reason: 'sleep' | 'freeze' | 'paralysis' }
  | { kind: 'stat'; side: Side; stat: StatKey; delta: number }
  | { kind: 'residual'; side: Side; ailment: Ailment; amount: number; hp: number }
  | { kind: 'faint'; side: Side }
  | { kind: 'timeout' }
  | { kind: 'end'; outcome: 'won' | 'lost' };

export interface PlayResult {
  battle: Battle;
  events: BattleEvent[];
  /** Só quando a batalha acabou neste turno. */
  capture?: DailyCapture;
  trainer?: TrainerCollection;
  evolution?: { from: Pokemon; to: Pokemon } | null;
}

export interface ForfeitResult {
  battle: Battle;
  capture: DailyCapture;
}

export function getBattle(): Promise<Battle> {
  return request<Battle>('/api/capture/today/battle');
}

export function startBattle(day: string, pokemonId: string): Promise<Battle> {
  return request<Battle>('/api/capture/today/battle', mutation('POST', { day, pokemonId }));
}

export function playCard(day: string, cardUid: string): Promise<PlayResult> {
  return request<PlayResult>('/api/capture/today/battle/play', mutation('POST', { day, cardUid }));
}

export function forfeitBattle(day: string): Promise<ForfeitResult> {
  return request<ForfeitResult>('/api/capture/today/battle/forfeit', mutation('POST', { day }));
}
