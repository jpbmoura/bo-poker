import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CardValue } from '../types/index.js';
import {
  BASE_XP,
  CONSENSUS_XP,
  MIN_NUMERIC_VOTES,
  deckIndexOf,
  scoreRound,
  targetIndex,
  type Ballot,
} from './xp.js';

let seq = 0;
const ballot = (vote: CardValue | null, online = true): Ballot => ({
  playerId: `p${++seq}`,
  vote,
  online,
});

/** Ganhos na ordem em que os ballots foram passados. */
function gains(ballots: Ballot[]): number[] {
  const { gainByPlayerId } = scoreRound(ballots);
  return ballots.map((b) => gainByPlayerId.get(b.playerId) ?? 0);
}

test('targetIndex interpola a média entre as duas cartas vizinhas', () => {
  // 17 fica entre 13 (idx 6) e 21 (idx 7).
  assert.equal(targetIndex(17), 6.5);
  // Cartas exatas caem no próprio índice.
  assert.equal(targetIndex(8), 5);
  assert.equal(targetIndex(0), 0);
  assert.equal(targetIndex(21), 7);
  // 4 fica no meio de 3 (idx 3) e 5 (idx 4).
  assert.equal(targetIndex(4), 3.5);
  // Fora da faixa satura nas pontas.
  assert.equal(targetIndex(-5), 0);
  assert.equal(targetIndex(100), 7);
});

test('tabela de XP: distância inteira, com o .5 do Math.round fixado', () => {
  // Para a distância ser um inteiro exato, a média tem de cair EM CIMA de uma
  // carta. Votos 1, 5, 8, 8, 3 somam 25 em 5 votos -> média 5 -> alvo idx 4.
  // Deck: 0(0) 1(1) 2(2) 3(3) 5(4) 8(5) 13(6) 21(7)
  //   '1'  idx 1 -> d=3 -> 10*(1-0.75) = 2.5  -> 3  (Math.round(2.5) sobe)
  //   '5'  idx 4 -> d=0 -> 10
  //   '8'  idx 5 -> d=1 -> 10*(1-0.25) = 7.5  -> 8  (Math.round(7.5) sobe)
  //   '3'  idx 3 -> d=1 -> 8
  assert.deepEqual(
    gains([ballot('1'), ballot('5'), ballot('8'), ballot('8'), ballot('3')]),
    [3, 10, 8, 8, 8],
  );

  // Votos 2, 5, 8 somam 15 em 3 -> média 5 -> alvo idx 4 de novo.
  //   '2' idx 2 -> d=2 -> 5
  assert.deepEqual(gains([ballot('2'), ballot('5'), ballot('8')]), [5, 10, 8]);
});

test('distâncias fracionárias arredondam para o inteiro mais próximo', () => {
  // votos 5, 8, 13, 21 -> média 11.75 -> entre 8 (idx 5) e 13 (idx 6) -> 5.75
  const g = gains([ballot('5'), ballot('8'), ballot('13'), ballot('21')]);
  // idx 4 -> d=1.75 -> 5.625 -> 6
  // idx 5 -> d=0.75 -> 8.125 -> 8
  // idx 6 -> d=0.25 -> 9.375 -> 9
  // idx 7 -> d=1.25 -> 6.875 -> 7
  assert.deepEqual(g, [6, 8, 9, 7]);
});

test('o cenário do smoke: 5, 8, 13 paga 7 / 10 / 8', () => {
  // média 8.667 -> entre 8 (idx 5) e 13 (idx 6) -> 5.1333
  const ballots = [ballot('5'), ballot('8'), ballot('13')];
  const score = scoreRound(ballots);
  assert.equal(score.awarded, true);
  assert.equal(score.consensus, false);
  assert.ok(Math.abs((score.targetIndex ?? 0) - 5.1333) < 0.001);
  assert.deepEqual(ballots.map((b) => score.gainByPlayerId.get(b.playerId)), [7, 10, 8]);
});

test('consenso paga o dobro para todo mundo, ignorando a distância', () => {
  const ballots = [ballot('5'), ballot('5'), ballot('5')];
  const score = scoreRound(ballots);
  assert.equal(score.consensus, true);
  assert.equal(score.awarded, true);
  assert.equal(score.targetIndex, deckIndexOf('5'));
  for (const b of ballots) {
    assert.equal(score.gainByPlayerId.get(b.playerId), CONSENSUS_XP);
    assert.equal(score.gainByPlayerId.get(b.playerId), BASE_XP * 2);
  }
});

test('não é consenso se alguém elegível ainda não votou', () => {
  const score = scoreRound([ballot('5'), ballot('5'), ballot('5'), ballot(null)]);
  assert.equal(score.consensus, false);
  assert.equal(score.awarded, true);
});

test('não é consenso se alguém votou ?', () => {
  const ballots = [ballot('5'), ballot('5'), ballot('5'), ballot('?')];
  const score = scoreRound(ballots);
  assert.equal(score.consensus, false);
  // Os três iguais ficam todos na média, então levam o XP cheio de distância 0.
  assert.deepEqual(ballots.map((b) => score.gainByPlayerId.get(b.playerId)), [10, 10, 10, 0]);
});

test('a trava anti-farm vence o consenso: 2 pessoas votando igual não pontuam', () => {
  const ballots = [ballot('5'), ballot('5')];
  const score = scoreRound(ballots);
  assert.equal(score.awarded, false);
  assert.equal(score.consensus, false);
  assert.equal(score.targetIndex, null);
  assert.deepEqual(ballots.map((b) => score.gainByPlayerId.get(b.playerId)), [0, 0]);
});

test('menos de 3 votos numéricos não pontua, mesmo com gente na mesa', () => {
  assert.equal(MIN_NUMERIC_VOTES, 3);
  const ballots = [ballot('5'), ballot('8'), ballot('?'), ballot(null)];
  const score = scoreRound(ballots);
  assert.equal(score.awarded, false);
  assert.deepEqual(ballots.map((b) => score.gainByPlayerId.get(b.playerId)), [0, 0, 0, 0]);
});

test('quem votou ? ou não votou fica com 0', () => {
  const ballots = [ballot('5'), ballot('8'), ballot('13'), ballot('?'), ballot(null)];
  const score = scoreRound(ballots);
  assert.equal(score.gainByPlayerId.get(ballots[3].playerId), 0);
  assert.equal(score.gainByPlayerId.get(ballots[4].playerId), 0);
});

test('offline COM voto conta; offline SEM voto nem aparece no placar', () => {
  const votedThenLeft = ballot('8', false);
  const ghost = ballot(null, false);
  const ballots = [ballot('5'), ballot('13'), votedThenLeft, ghost];
  const score = scoreRound(ballots);
  assert.equal(score.awarded, true);
  assert.ok((score.gainByPlayerId.get(votedThenLeft.playerId) ?? 0) > 0);
  assert.equal(score.gainByPlayerId.has(ghost.playerId), false);
});

test('o fantasma offline não impede o consenso', () => {
  const ballots = [ballot('3'), ballot('3'), ballot('3'), ballot(null, false)];
  const score = scoreRound(ballots);
  assert.equal(score.consensus, true);
});

test('caso extremo documentado: 0, 0, 21 paga 0 / 0 / 4', () => {
  // A média sai em espaço de VALOR (7) e a distância em espaço de ÍNDICE, então
  // numa rodada muito dispersa o outlier pode levar mais que a maioria. Aceito
  // de propósito: trocar isso desalinharia o XP da "Média" que a mesa vê.
  const ballots = [ballot('0'), ballot('0'), ballot('21')];
  const score = scoreRound(ballots);
  assert.ok(Math.abs((score.targetIndex ?? 0) - 4.6667) < 0.001);
  assert.deepEqual(ballots.map((b) => score.gainByPlayerId.get(b.playerId)), [0, 0, 4]);
});

test('distância de 4 casas ou mais zera', () => {
  // votos 0,0,0,21 -> média 5.25 -> entre 5(4) e 8(5) -> 4.0833
  const ballots = [ballot('0'), ballot('0'), ballot('0'), ballot('21')];
  const score = scoreRound(ballots);
  assert.equal(score.gainByPlayerId.get(ballots[0].playerId), 0);
});

test('mesa vazia ou sem votos não quebra', () => {
  const empty = scoreRound([]);
  assert.equal(empty.awarded, false);
  assert.equal(empty.gainByPlayerId.size, 0);

  const noVotes = scoreRound([ballot(null), ballot(null), ballot(null)]);
  assert.equal(noVotes.awarded, false);
});

test('é determinístico: mesma entrada, mesma saída', () => {
  const ballots = [ballot('3'), ballot('8'), ballot('13')];
  assert.deepEqual(gains(ballots), gains(ballots));
});

test('espectador ganha a média do XP dos votos numéricos', () => {
  // 5, 8, 13 pagam 7 / 10 / 8 -> média 8.33 -> 8
  assert.equal(scoreRound([ballot('5'), ballot('8'), ballot('13')]).spectatorXp, 8);
  // 1, 5, 8, 8, 3 pagam 3 / 10 / 8 / 8 / 8 -> média 7.4 -> 7
  assert.equal(
    scoreRound([ballot('1'), ballot('5'), ballot('8'), ballot('8'), ballot('3')]).spectatorXp,
    7,
  );
});

test('espectador ganha mais quando a mesa converge', () => {
  const tight = scoreRound([ballot('5'), ballot('8'), ballot('8')]).spectatorXp;
  const spread = scoreRound([ballot('1'), ballot('8'), ballot('21')]).spectatorXp;
  assert.ok(tight > spread);
});

test('no consenso o espectador ganha o mesmo que a mesa', () => {
  assert.equal(scoreRound([ballot('5'), ballot('5'), ballot('5')]).spectatorXp, CONSENSUS_XP);
});

test('rodada que não pontua não paga o espectador', () => {
  assert.equal(scoreRound([ballot('5'), ballot('5')]).spectatorXp, 0);
  assert.equal(scoreRound([]).spectatorXp, 0);
});

test('? e quem não votou não puxam a média do espectador para baixo', () => {
  const score = scoreRound([ballot('5'), ballot('8'), ballot('13'), ballot('?'), ballot(null)]);
  assert.equal(score.spectatorXp, 8);
});
