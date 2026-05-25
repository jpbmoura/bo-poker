import type { CardValue, SerializedPlayer } from '../types';

export interface VoteStats {
  average: number | null;
  mode: string[];
  consensus: boolean;
  votingPlayers: number;
  votedCount: number;
  numericVotes: number[];
  outlierIds: Set<string>;
}

const isNumeric = (v: CardValue | 'HIDDEN' | null): v is CardValue =>
  v !== null && v !== 'HIDDEN' && v !== '?';

function computeOutliers(
  voters: SerializedPlayer[],
  consensus: boolean,
): Set<string> {
  if (consensus) return new Set();
  const numericPlayers = voters
    .filter((p) => isNumeric(p.vote))
    .map((p) => ({ id: p.id, n: Number(p.vote) }))
    .filter((p) => !Number.isNaN(p.n));

  if (numericPlayers.length < 3) return new Set();

  const values = numericPlayers.map((p) => p.n);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 2) return new Set();

  const out = new Set<string>();
  for (const p of numericPlayers) {
    if (p.n === min || p.n === max) out.add(p.id);
  }
  return out;
}

export function computeStats(players: SerializedPlayer[]): VoteStats {
  const voters = players.filter((p) => p.role === 'voter');
  const voted = voters.filter((p) => p.vote !== null);
  const numericVotes = voted
    .filter((p) => isNumeric(p.vote))
    .map((p) => Number(p.vote))
    .filter((n) => !Number.isNaN(n));

  const average = numericVotes.length
    ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
    : null;

  const allVotesRaw = voted.map((p) => String(p.vote));
  const counts = new Map<string, number>();
  for (const v of allVotesRaw) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  const mode: string[] = [];
  for (const [val, c] of counts) if (c === max && max > 0) mode.push(val);

  const everyoneVoted = voters.length > 0 && voted.length === voters.length;
  const allNumeric = voted.every((p) => isNumeric(p.vote));
  const allEqual =
    numericVotes.length > 0 &&
    numericVotes.every((n) => n === numericVotes[0]);
  const consensus = everyoneVoted && allNumeric && allEqual;

  const outlierIds = computeOutliers(voted, consensus);

  return {
    average,
    mode,
    consensus,
    votingPlayers: voters.length,
    votedCount: voted.length,
    numericVotes,
    outlierIds,
  };
}

export function formatAverage(avg: number | null): string {
  if (avg === null) return '—';
  return avg.toFixed(1);
}
