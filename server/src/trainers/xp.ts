import { CARD_SEQUENCE, type CardValue } from '../types/index.js';

/** XP de uma estimativa perfeitamente na média. */
export const BASE_XP = 10;
/** Distância (em casas do deck) a partir da qual a rodada não paga mais nada. */
export const MAX_DISTANCE = 4;
/** Mesa inteira na mesma carta: o dobro, sem passar pela fórmula de distância. */
export const CONSENSUS_XP = BASE_XP * 2;
/**
 * Trava anti-farm: com menos que isto a rodada não pontua para ninguém. Duas
 * pessoas revelando e resetando em laço são exatamente o cenário que ela barra.
 */
export const MIN_NUMERIC_VOTES = 3;

/**
 * O deck sem o `?`, derivado do CARD_SEQUENCE para os dois não poderem divergir.
 * O índice nesta lista é a unidade em que a distância é medida — o deck é
 * Fibonacci, então 13 vs 21 é UMA casa, não oito pontos.
 */
const NUMERIC_CARDS: CardValue[] = CARD_SEQUENCE.filter((c) => c !== '?');
const NUMERIC_VALUES: number[] = NUMERIC_CARDS.map((c) => Number(c));

export function isNumericCard(vote: CardValue | null): vote is CardValue {
  return vote !== null && vote !== '?';
}

export function deckIndexOf(vote: CardValue): number {
  return NUMERIC_CARDS.indexOf(vote);
}

/**
 * Um voto na perspectiva do placar. Espectadores NÃO entram — quem chama filtra.
 * O XP deles sai pronto em `RoundScore.spectatorXp`.
 */
export interface Ballot {
  playerId: string;
  vote: CardValue | null;
  online: boolean;
}

export interface RoundScore {
  /** false quando a rodada não atingiu MIN_NUMERIC_VOTES. */
  awarded: boolean;
  consensus: boolean;
  /** Índice fracionário alvo no deck; null quando a rodada não pontuou. */
  targetIndex: number | null;
  /** XP por jogador. Todo votante elegível aparece, inclusive com 0. */
  gainByPlayerId: Map<string, number>;
  /**
   * XP de cada espectador: a média do XP dos votos numéricos. Quanto mais a mesa
   * converge para a média, mais quem assiste ganha. 0 quando a rodada não pontua.
   */
  spectatorXp: number;
}

/**
 * Posição FRACIONÁRIA da média no deck, interpolada entre as duas cartas
 * vizinhas. Média 17 fica entre 13 (idx 6) e 21 (idx 7) e devolve 6.5 — assim
 * quem votou 13 e quem votou 21 recebem o mesmo XP, em vez de a carta mais
 * próxima levar tudo por um empate técnico.
 */
export function targetIndex(average: number): number {
  const last = NUMERIC_VALUES.length - 1;
  if (average <= NUMERIC_VALUES[0]) return 0;
  if (average >= NUMERIC_VALUES[last]) return last;
  for (let i = 0; i < last; i++) {
    const lo = NUMERIC_VALUES[i];
    const hi = NUMERIC_VALUES[i + 1];
    if (average <= hi) return i + (average - lo) / (hi - lo);
  }
  return last;
}

function xpForDistance(distance: number): number {
  const raw = BASE_XP * (1 - distance / MAX_DISTANCE);
  return raw <= 0 ? 0 : Math.round(raw);
}

/**
 * Quem realmente conta na rodada. Mesma regra do `eligibleVoters` em
 * client/src/utils/stats.ts: quem votou 8 e fechou o notebook deu um dado real e
 * continua contando; um fantasma que nunca votou não pode travar o consenso.
 *
 * ATENÇÃO: o consenso é calculado aqui (para o XP) e também no `computeStats` do
 * cliente (para o confete e o banner), a partir de snapshots diferentes. Se
 * mexer na regra, mexa nos dois.
 */
function eligible(ballots: Ballot[]): Ballot[] {
  return ballots.filter((b) => b.online || b.vote !== null);
}

export function scoreRound(ballots: Ballot[]): RoundScore {
  const voters = eligible(ballots);
  const gainByPlayerId = new Map<string, number>();
  for (const v of voters) gainByPlayerId.set(v.playerId, 0);

  const numeric = voters.filter((v) => isNumericCard(v.vote));

  // A trava vem ANTES do consenso de propósito: numa mesa de 2 pessoas votando
  // igual as duas regras se contradizem, e quem tem de vencer é a trava.
  if (numeric.length < MIN_NUMERIC_VOTES) {
    return {
      awarded: false,
      consensus: false,
      targetIndex: null,
      gainByPlayerId,
      spectatorXp: 0,
    };
  }

  const values = numeric.map((v) => Number(v.vote));
  const everyoneVoted = voters.every((v) => v.vote !== null);
  const allNumeric = voters.length === numeric.length;
  const allEqual = values.every((n) => n === values[0]);
  const consensus = everyoneVoted && allNumeric && allEqual;

  if (consensus) {
    for (const v of voters) gainByPlayerId.set(v.playerId, CONSENSUS_XP);
    return {
      awarded: true,
      consensus: true,
      targetIndex: deckIndexOf(numeric[0].vote as CardValue),
      gainByPlayerId,
      spectatorXp: CONSENSUS_XP,
    };
  }

  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const target = targetIndex(average);
  let totalGain = 0;
  for (const v of numeric) {
    const distance = Math.abs(deckIndexOf(v.vote as CardValue) - target);
    const gain = xpForDistance(distance);
    gainByPlayerId.set(v.playerId, gain);
    totalGain += gain;
  }

  // Só quem deu estimativa numérica entra na média: `?` e quem não votou dizem
  // sobre participação, não sobre o acerto da mesa.
  const spectatorXp = Math.round(totalGain / numeric.length);

  return { awarded: true, consensus: false, targetIndex: target, gainByPlayerId, spectatorXp };
}
