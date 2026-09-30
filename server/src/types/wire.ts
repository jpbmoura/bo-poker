// SYNC: este arquivo DEVE ser byte-idêntico em client/src/types/wire.ts e
// server/src/types/wire.ts. Garantido por server/src/types/wire.test.ts.
// Mantenha-o SEM imports para que a exigência de extensão .js do servidor
// nunca se aplique e a comparação literal continue válida.

export type CardValue = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?';

export const CARD_SEQUENCE: CardValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];

export type PlayerRole = 'voter' | 'spectator';

export interface Pokemon {
  id: number;
  name: string;
  sprite: string;
}

/**
 * Progresso do Pokémon ATIVO de um jogador. Público: a mesa inteira vê o XP de
 * todo mundo.
 *
 * `stage` é a forma EXIBIDA, e não a derivada do XP. Durante o reveal a barra
 * passa do limiar de propósito — é o aviso de que a evolução vem aí — enquanto o
 * sprite só troca na rodada seguinte, para o `room:state` não entregar a
 * animação de evolução segundos antes de ela tocar.
 */
export interface TrainerProgress {
  /** Id da linha em `trainer_pokemon`. */
  pokemonId: string;
  /** Slug da linha evolutiva (EVOLUTION_LINES[].id). */
  lineId: string;
  stage: number;
  /** Maior estágio da linha: 2 nas normais, 1 na do Eevee. */
  maxStage: number;
  xp: number;
  /** XP do próximo limiar; null quando já está no estágio final. */
  nextXp: number | null;
  /** Eevee que cruzou o limiar e ainda não escolheu a pedra. */
  pendingChoice: boolean;
}

/**
 * Um jogador na perspectiva de UM espectador específico: `vote` vem sem máscara
 * para esse espectador e como 'HIDDEN' para os demais até o reveal.
 */
export interface SerializedPlayer {
  id: string;
  name: string;
  /** Handle do GitHub. Vem SEMPRE da sessão, nunca do payload do cliente. */
  login: string | null;
  /** Espécie EXIBIDA. Resolvida pelo servidor a partir do catálogo. */
  pokemon: Pokemon;
  /** Progresso do treinador. Null enquanto a pessoa não tem nenhum Pokémon. */
  progress: TrainerProgress | null;
  role: PlayerRole;
  online: boolean;
  joinedAt: number;
  vote: CardValue | 'HIDDEN' | null;
}

export interface RoomState {
  id: string;
  /** Nome dado pelo dono. Persistido; viaja no estado para renomear ao vivo. */
  name: string;
  /**
   * Se QUEM RECEBE este estado é o dono da sala. Calculado por espectador de
   * propósito: o `ownerId` cru é um id de usuário do Better Auth e não precisa
   * ser difundido para todo mundo na mesa.
   */
  isOwner: boolean;
  createdAt: number;
  revealed: boolean;
  cardSequence: CardValue[];
  players: SerializedPlayer[];
  topic?: string;
}

export type RoomErrorCode =
  | 'ROOM_FULL'
  | 'INVALID_NAME'
  | 'INVALID_ROOM'
  | 'NOT_IN_ROOM'
  | 'SESSION_EXPIRED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_UNAVAILABLE';

export interface RoomError {
  code: RoomErrorCode;
  message: string;
}

/**
 * client -> server `room:join`
 *
 * Não carrega identidade NEM Pokémon: quem é o jogador vem da sessão autenticada
 * do socket, e a espécie vem da progressão da conta. Só o `name` é cosmético e
 * validado aqui.
 *
 * O Pokémon ter saído daqui é o que fecha a injeção de `sprite` arbitrário: até
 * então o cliente mandava uma URL qualquer que a mesa inteira renderizava.
 */
export interface JoinPayload {
  roomId: string;
  name: string;
  role: PlayerRole;
}

/** server -> client `room:joined` */
export interface JoinedPayload {
  playerId: string;
  role: PlayerRole;
}

/**
 * server -> client `room:closed`
 *
 * A sala deixou de existir enquanto a pessoa estava dentro. Hoje só o dono
 * excluindo produz isto, mas o `reason` deixa espaço para outros motivos.
 */
export interface RoomClosedPayload {
  roomId: string;
  reason: 'deleted';
}

/**
 * server -> sala `round:result`
 *
 * O resultado de XP da rodada. Vai por broadcast único (e não socket a socket
 * como o `room:state`) porque é idêntico para todo mundo — não há nada a
 * mascarar depois do reveal.
 *
 * O cliente NÃO recalcula esses números: a fórmula vive só no servidor, que é
 * quem tem o snapshot autoritativo dos votos no instante do reveal.
 */
export interface RoundResultPayload {
  /** false quando a rodada não atingiu o mínimo de votos numéricos. */
  awarded: boolean;
  consensus: boolean;
  /** Índice fracionário alvo no deck; null quando a rodada não pontuou. */
  targetIndex: number | null;
  /**
   * Votantes elegíveis e espectadores online. Espectador ganha a média do XP
   * dos votos numéricos (ou nada, quando a rodada não pontuou).
   */
  xp: Array<{ playerId: string; gained: number; total: number }>;
}

/**
 * server -> sala `pokemon:evolved`
 *
 * Uma emissão por evolução. Os dois sprites vão prontos para o cliente não
 * precisar consultar o catálogo em tempo de animação.
 */
export interface EvolutionEvent {
  playerId: string;
  playerName: string;
  from: Pokemon;
  to: Pokemon;
  /** Ordem de reprodução quando várias evoluções caem na mesma rodada. */
  seq: number;
}

export const ROOM_ID_MAX_LENGTH = 20;
export const PLAYER_NAME_MAX_LENGTH = 32;
export const ROOM_NAME_MAX_LENGTH = 40;

/**
 * Canonicaliza o id da sala. Cliente e servidor DEVEM usar esta mesma função,
 * senão `/room/abc` e `/room/ABC` viram salas diferentes.
 */
export function normalizeRoomId(raw: string): string | null {
  const id = (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (id.length < 1 || id.length > ROOM_ID_MAX_LENGTH) return null;
  return id;
}

/** Normaliza o nome de exibição (cosmético; a identidade vem da sessão). */
export function normalizePlayerName(raw: string): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Normaliza o nome da sala. Corta no limite em vez de rejeitar: o nome é
 * cosmético e um `PATCH` recusado por um caractere a mais só irritaria.
 */
export function normalizeRoomName(raw: string): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, ROOM_NAME_MAX_LENGTH);
}
