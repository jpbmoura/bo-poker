import type { VoteStats } from '../utils/stats';
import { formatAverage } from '../utils/stats';
import { cn } from '../utils/cn';

interface StatsPanelProps {
  stats: VoteStats;
  visible: boolean;
}

export function StatsPanel({ stats, visible }: StatsPanelProps) {
  if (!visible) return null;
  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="bg-surface border border-border rounded-2xl px-6 py-4 flex flex-wrap items-center justify-around gap-6">
        <Stat label="Média" value={formatAverage(stats.average)} />
        <Stat
          label="Moda"
          value={stats.mode.length === 0 ? '—' : stats.mode.join(', ')}
        />
        <Stat
          label="Consenso"
          value={stats.consensus ? 'Sim ✨' : 'Não'}
          highlight={stats.consensus}
        />
        <Stat
          label="Votaram"
          value={`${stats.votedCount} / ${stats.votingPlayers}`}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center min-w-[80px]">
      <span className="text-xs uppercase tracking-wider text-subtle">{label}</span>
      <span
        className={cn(
          'text-xl font-bold',
          highlight ? 'text-highlight' : 'text-text',
        )}
      >
        {value}
      </span>
    </div>
  );
}
