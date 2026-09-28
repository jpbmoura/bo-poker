import type { VoteStats } from '../utils/stats';
import { formatAverage } from '../utils/stats';

interface StatsPanelProps {
  stats: VoteStats;
  visible: boolean;
}

export function StatsPanel({ stats, visible }: StatsPanelProps) {
  if (!visible) return null;
  return (
    <div className="flex justify-center animate-fade-up" role="status">
      <div className="flex flex-col items-center gap-0.5 px-7 py-3 bg-surface-2/60 border border-border rounded-2xl backdrop-blur">
        <span className="text-3xl font-mono font-semibold text-text tabular-nums leading-none">
          {formatAverage(stats.average)}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-subtle">Média</span>
      </div>
    </div>
  );
}
